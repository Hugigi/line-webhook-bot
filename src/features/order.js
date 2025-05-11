// src/features/order.js
const stringSimilarity = require('string-similarity');
const { reply, postToSheet, loadMenu } = require('../utils');

// Helper: normalize student names
const normalize = str => str.trim().toLowerCase();

module.exports = {
  name: 'order',

  async handle(event, config) {
    const msg = event.message.text.trim();
    console.log('[order] 收到訊息：', msg);

    // —— 切換店家 ——
    const switchMatch = msg.match(/^切換店家[:：]\s*(.+)$/);
    if (switchMatch) {
      const vendor = switchMatch[1].trim();
      config.currentVendor = vendor;
      console.log('[order] 已切換至店家：', vendor);
      await reply(event, `✅ 已切換至「${vendor}」`, config);
      return true;
    }

    // —— 取消訂單 ——
    if (/^取消訂單[:：]/.test(msg)) {
      const student = msg.replace(/^取消訂單[:：]/, '').trim();
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      if (recs.length === 0) {
        await reply(event, `⚠️ 找不到「${student}」的訂單`, config);
        return true;
      }
      // 批次負值抵消
      const tasks = recs.map(r => {
        const negItems = r.items.map(i => ({ vendor: i.vendor, name: i.name, qty: -i.qty, price: i.price }));
        const negTotal = -r.total;
        return postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { type: 'cancel', student, items: negItems, total: negTotal, date: r.date }
        );
      });
      try {
        await Promise.all(tasks);
      } catch (e) {
        console.error(e);
        await reply(event, `❌ 系統錯誤：${e.message}`, config);
        return true;
      }
      config.orderRecords = config.orderRecords.filter(r => normalize(r.student) !== normalize(student));
      await reply(event, `✅ 已取消「${student}」的 ${recs.length} 筆訂單`, config);
      return true;
    }

    // —— 修改訂單 ——
    if (/^修改訂單[:：]/.test(msg)) {
      const m = msg.match(/^修改訂單[:：](.+?)[:：](.+)$/);
      if (!m) {
        await reply(event, `⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」`, config);
        return true;
      }
      const [_, stu, body] = m;
      const student = stu.trim();
      // 抵消舊單
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      const tasks = recs.map(r => {
        const negItems = r.items.map(i => ({ vendor: i.vendor, name: i.name, qty: -i.qty, price: i.price }));
        const negTotal = -r.total;
        return postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { type: 'cancel', student, items: negItems, total: negTotal, date: r.date }
        );
      });
      try {
        await Promise.all(tasks);
      } catch (e) {
        console.error(e);
        await reply(event, `❌ 系統錯誤：${e.message}`, config);
        return true;
      }
      config.orderRecords = config.orderRecords.filter(r => normalize(r.student) !== normalize(student));
      // 下新單
      let result;
      try {
        result = await this._processLine(student, body.trim(), config);
      } catch (e) {
        console.error(e);
        await reply(event, `❌ 系統錯誤：${e.message}`, config);
        return true;
      }
      await reply(event, `✅ 修改訂單完成：\n${result}`, config);
      return true;
    }

    // —— 一般下訂單 —— 
    const lines   = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pattern = /^(.+?)\s*[:：]\s*(.+)$/;
    const orders  = lines.filter(l => pattern.test(l));
    if (!orders.length) return false;

    const ordersPayload = [];
    const replies       = [];

    for (const l of orders) {
      const [, student, body] = l.match(pattern);
      try {
        // buildOrderPayload 會跑清洗、匹配、模糊比對、計算 items & total
        const payload = await this._buildOrderPayload(student.trim(), body.trim(), config);
        ordersPayload.push(payload);

       const detail = payload.items
         .map(i => `${i.vendor}-${i.name} x${i.qty}($${i.price})`)
         .join(' + ');
        replies.push(`✅ ${payload.student}：${detail}，共 $${payload.total}`);
      } catch (err) {
       console.error(err);
       replies.push(`⚠️ ${student.trim()}：訂單錯誤，請重新確認`);
      }
    }

// 一次性傳整包到後端，避免 race condition
await postToSheet(
  config.SHEETS_WEBAPP_URL,
  'order',
  { type: 'bulkOrder', orders: ordersPayload }
);

await reply(event, replies.join('\n'), config);
return true;

  },

  // 內部：組建訂單 payload（含清洗、模糊比對、跨店家、計算 total）
async _buildOrderPayload(student, rest, config) {
  const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
  const parts   = cleaned.split(/[＋+、,]/).map(p => p.trim()).filter(Boolean);
  const menus   = loadMenu(config.MENU_PATH);
  const items   = [];
  let total     = 0;
  const missing = [];

  for (let raw of parts) {
    let vendor = config.currentVendor;
    let key    = raw;
    const vm   = raw.match(/^(.+?)-(.+)$/);
    if (vm && menus[vm[1].trim()]) {
      vendor = vm[1].trim();
      key    = vm[2].trim();
    }

    // 數量解析
    let qty = 1;
    const qm = key.match(/(.+?)x(\d+)$/i);
    if (qm) {
      key = qm[1];
      qty = +qm[2];
    }

    let itemName = key;
    let price    = menus[vendor]?.[itemName];

    // **模糊比對**（保留原邏輯）
    if (price == null) {
      const keys = Object.keys(menus[vendor] || {});
      if (keys.length) {
        const { bestMatch, bestMatchIndex } =
          stringSimilarity.findBestMatch(itemName, keys);
        if (bestMatch.rating > 0.6) {
          itemName = keys[bestMatchIndex];
          price    = menus[vendor][itemName];
        }
      }
    }

    // 跨店家自動匹配
    if (price == null) {
      for (const v of Object.keys(menus)) {
        if (menus[v][itemName] != null) {
          vendor = v;
          price  = menus[v][itemName];
          break;
        }
      }
    }

    if (price == null) {
      missing.push(raw);
      continue;
    }

    items.push({ vendor, name: itemName, qty, price });
    total += price * qty;
  }

  if (missing.length) {
    throw new Error(`找不到 ${missing.join('、')}`);
  }

  // 回傳 ISO 時間字串，讓 Apps Script 正確解析
  const date = new Date().toISOString();
  return { student, items, total, date };
},

};
