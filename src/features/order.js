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
      console.log('[order] 取消訂單流程啟動');
      const student = msg.replace(/^取消訂單[:：]/, '').trim();
      console.log('[order] 目標學生：', student);

      // 找出記憶體中的訂單
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      if (recs.length === 0) {
        await reply(event, `⚠️ 找不到「${student}」的訂單`, config);
        return true;
      }

      // 準備負值抵消
      const tasks = recs.map(r => {
        const negItems = r.items.map(i => ({
          vendor: i.vendor,
          name: i.name,
          qty: -i.qty,
          price: i.price
        }));
        const negTotal = -r.total;
        console.log('[order] 準備負值抵消：', { student, items: negItems, total: negTotal, date: r.date });
        return postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: negTotal, date: r.date });
      });
      try {
        await Promise.all(tasks);
      } catch (e) {
        console.error(e);
        await reply(event, `❌ 系統錯誤：${e.message}`, config);
        return true;
      }

      // 清除記憶體
      config.orderRecords = config.orderRecords.filter(r => normalize(r.student) !== normalize(student));
      console.log('[order] 已刪除記憶體訂單，新長度：', config.orderRecords.length);

      await reply(event, `✅ 已取消「${student}」的 ${recs.length} 筆訂單`, config);
      return true;
    }

    // —— 修改訂單 ——
    if (/^修改訂單[:：]/.test(msg)) {
      console.log('[order] 修改訂單流程啟動');
      const m = msg.match(/^修改訂單[:：](.+?)[:：](.+)$/);
      if (!m) {
        await reply(event, `⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」`, config);
        return true;
      }
      const student = m[1].trim();
      const body = m[2].trim();
      console.log('[order] 目標學生：', student, '新內容：', body);

      // 負值抵消舊單
      const recs = config.orderRecords.filter(r => normalize(r.student) === normalize(student));
      const tasks = recs.map(r => {
        const negItems = r.items.map(i => ({ vendor: i.vendor, name: i.name, qty: -i.qty, price: i.price }));
        const negTotal = -r.total;
        console.log('[order] 準備修改抵消：', { student, items: negItems, total: negTotal, date: r.date });
        return postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: negTotal, date: r.date });
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
        result = await this._processLine(student, body, config);
      } catch (e) {
        console.error(e);
        await reply(event, `❌ 系統錯誤：${e.message}`, config);
        return true;
      }
      console.log('[order] 修改後新單結果：', result);
      await reply(event, `✅ 修改訂單完成：\n${result}`, config);
      return true;
    }

    // —— 一般下訂單 ——
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)[:：](.+)$/.test(l));
    if (!orders.length) return false;

    console.log('[order] 一般訂單，共', orders.length, '行');
    const replies = [];
    for (const l of orders) {
      const [, student, body] = l.match(/^(.+?)[:：](.+)$/);
      try {
        replies.push(await this._processLine(student.trim(), body.trim(), config));
      } catch (e) {
        console.error(e);
        replies.push(`❌ ${student.trim()}：處理失敗：${e.message}`);
      }
    }
    await reply(event, replies.join('\n'), config);
    return true;
  },

  // 內部：解析一行訂單並發送正值訂單
  async _processLine(student, rest, config) {
    // 清理不要、不加語句
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
    const parts = cleaned.split(/[＋+、,]/).map(p => p.trim()).filter(Boolean);

    const menus = loadMenu(config.MENU_PATH);
    const items = [];
    let total = 0;
    const missing = [];

    for (let raw of parts) {
      let vendor = config.currentVendor;
      let key = raw;
      const vm = raw.match(/^(.+?)-(.+)$/);
      if (vm && menus[vm[1].trim()]) {
        vendor = vm[1].trim();
        key = vm[2].trim();
      }

      if (!menus[vendor]) {
        missing.push(raw);
        continue;
      }

      let qty = 1;
      const qm = key.match(/(.+?)x(\d+)$/i);
      if (qm) { key = qm[1]; qty = +qm[2]; }

      let itemName = key;
      let price = menus[vendor][itemName];
      if (price == null) {
        const keys = Object.keys(menus[vendor]);
        const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(itemName, keys);
        if (bestMatch.rating > 0.6) {
          itemName = keys[bestMatchIndex];
          price = menus[vendor][itemName];
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
      return `⚠️ ${student}：找不到 ${missing.join('、')}`;
    }

    // 使用台北時區字串
    const date = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log('[order] 發送正值訂單：', { student, vendor: config.currentVendor, items, total, date });
    config.orderRecords.push({ student, items, total, date });

    try {
      await postToSheet(
        config.SHEETS_WEBAPP_URL,
        'order',
        { student, items, total, date }
      );
    } catch (e) {
      console.error(e);
      throw new Error(e.message);
    }

    const detail = items.map(i => `${i.vendor}-${i.name} x${i.qty}($${i.price})`).join(' + ');
    return `✅ ${student}：${detail}，共 $${total}`;
  }
};
