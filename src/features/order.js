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
    if (/^切換店家[:：]/.test(msg)) {
      const vendor = msg.replace(/^切換店家[:：]/, '').trim();
      config.currentVendor = vendor;
      console.log('[order] 切換店家：', vendor);
      await reply(event, `✅ 已切換至「${vendor}」`, config);
      return true;
    }

    // —— 取消訂單 ——
    if (/^取消訂單[:：]/.test(msg)) {
      const student = msg.replace(/^取消訂單[:：]/, '').trim();
      console.log('[order] 取消訂單流程啟動：', student);
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      if (!recs.length) {
        await reply(event, `⚠️ 找不到「${student}」的訂單`, config);
        return true;
      }

      // 負值抵消
      const tasks = recs.map(r => {
        const negItems = r.items.map(i => ({
          name:  i.name,
          qty:   -i.qty,
          price: i.price
        }));
        const negTotal = -r.total;
        console.log('[order] 送出負值抵銷：', { student, items: negItems, total: negTotal, date: r.date });
        return postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { type: 'cancel', student, items: negItems, total: negTotal, date: r.date }
        );
      });
      try {
        await Promise.all(tasks);
      } catch (err) {
        console.error('[order] cancel POST 失敗', err);
        await reply(event, `❌ 系統錯誤：${err.message}`, config);
        return true;
      }

      // 清除記憶體
      config.orderRecords = config.orderRecords.filter(r => normalize(r.student) !== normalize(student));
      await reply(event, `✅ 已取消「${student}」的 ${recs.length} 筆訂單`, config);
      return true;
    }

    // —— 修改訂單 ——
    if (/^修改訂單[:：]/.test(msg)) {
      const m = msg.match(/^修改訂單[:：](.+?)[:：](.+)$/);
      if (!m) {
        await reply(event, '⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」', config);
        return true;
      }
      const [, rawStudent, body] = m;
      const student = rawStudent.trim();
      console.log('[order] 修改訂單流程啟動：', student, body.trim());

      // 抵消舊單
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      const cancelTasks = recs.map(r => {
        const negItems = r.items.map(i => ({
          name:  i.name,
          qty:   -i.qty,
          price: i.price
        }));
        const negTotal = -r.total;
        console.log('[order] 修改抵銷舊單：', { student, items: negItems, total: negTotal, date: r.date });
        return postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { type: 'cancel', student, items: negItems, total: negTotal, date: r.date }
        );
      });
      try {
        await Promise.all(cancelTasks);
      } catch (err) {
        console.error('[order] 修改抵銷失敗', err);
        await reply(event, `❌ 系統錯誤：${err.message}`, config);
        return true;
      }
      config.orderRecords = config.orderRecords.filter(r => normalize(r.student) !== normalize(student));

      // 下新單
      try {
        const res = await this._processLine(student, body.trim(), config);
        await reply(event, `✅ 修改訂單完成：\n${res}`, config);
      } catch (err) {
        console.error('[order] 修改下新單失敗', err);
        await reply(event, `⚠️ ${student}：訂單錯誤，請重新確認`, config);
      }
      return true;
    }

    // —— 一般下訂單 ——
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)：(.+)$/.test(l));
    if (!orders.length) return false;

    const replies = [];
    for (const l of orders) {
      const [, student, body] = l.match(/^(.+?)：(.+)$/);
      console.log('[order] 處理訂單：', student, body);
      try {
        const res = await this._processLine(student.trim(), body.trim(), config);
        replies.push(res);
      } catch (err) {
        console.error('[order] 一般下單失敗', err);
        replies.push(`⚠️ ${student.trim()}：訂單錯誤，請重新確認`);
      }
    }
    await reply(event, replies.join('\n'), config);
    return true;
  },

  // 內部：解析一行訂單並發送正值訂單
  async _processLine(student, rest, config) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
    const parts   = cleaned.split(/[＋+、,]/).map(p => p.trim()).filter(Boolean);

    const menus = loadMenu(config.MENU_PATH);
    const items = [];
    let total   = 0;
    const missing = [];

    for (let raw of parts) {
      let vendor = config.currentVendor;
      let key    = raw;
      const vm = raw.match(/^(.+?)-(.+)$/);
      if (vm && menus[vm[1].trim()]) {
        vendor = vm[1].trim();
        key    = vm[2].trim();
      }

      let qty = 1;
      const qm = key.match(/(.+?)x(\d+)$/i);
      if (qm) {
        key = qm[1];
        qty = +qm[2];
      }

      let price = menus[vendor]?.[key];

      if (price == null) {
        const keys = Object.keys(menus[vendor] || {});
        const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(key, keys);
        if (bestMatch.rating > 0.6) {
          key   = keys[bestMatchIndex];
          price = menus[vendor][key];
        }
      }
      if (price == null) {
        for (const v of Object.keys(menus)) {
          if (menus[v][key] != null) {
            vendor = v;
            price  = menus[v][key];
            break;
          }
        }
      }

      if (price == null) {
        missing.push(raw);
        continue;
      }

      items.push({ vendor, name: key, qty, price });
      total += price * qty;
    }

    if (missing.length) {
      throw new Error(`找不到 ${missing.join('、')}`);
    }

    const date = new Date().toISOString();
    config.orderRecords.push({ student, items, total, date });

    console.log('[order] 正值下單 payload:', { type:'order', student, items, total, date });
    await postToSheet(
      config.SHEETS_WEBAPP_URL,
      'order',
      { type: 'order', student, items, total, date }
    );

    const detail = items.map(i => `${i.vendor}-${i.name} x${i.qty}($${i.price})`).join(' + ');
    return `✅ ${student}：${detail}，共 $${total}`;
  }
};
