/**
 * src/features/order.js
 * 重寫版：下訂單／取消／修改，強化 Debug 與修正 student 欄位
 */

const stringSimilarity = require('string-similarity');
const yiBoParser       = require('../../parsers/yiBoParser');
const { reply, postToSheet, loadMenu } = require('../utils');

module.exports = {
  name: 'order',

  async handle(event, config) {
    const msg = event.message.text.trim();
    console.log('[order] 收到訊息：', msg);

    // —— 取消訂單 —— 
    if (msg.startsWith('取消訂單：')) {
      console.log('[order] 取消訂單流程啟動');
      const student = msg.replace(/^取消訂單：/, '').trim();
      console.log('[order] 目標學生：', student);

      // 1) snapshot 記憶體訂單
      const recs = config.orderRecords.filter(r => r.student === student);
      if (recs.length === 0) {
        await reply(event, `⚠️ 找不到「${student}」的訂單`, config);
        return true;
      }

      // 2) 逐筆 post 負值抵消
      for (const r of recs) {
        const negItems = r.items.map(i => ({
          name:  i.name,
          qty:   -i.qty,
          price: i.price
        }));
        const negTotal = -r.total;
        console.log('[order] 發送負值抵消單：', {
          student,
          items: negItems,
          total: negTotal,
          date:  r.date
        });
        await postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { student, items: negItems, total: negTotal, date: r.date }
        );
      }

      // 3) 清除記憶體
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);
      console.log('[order] 記憶體中刪除該生所有記錄，新記憶體長度：', config.orderRecords.length);

      await reply(event, `✅ 已取消「${student}」的 ${recs.length} 筆訂單`, config);
      return true;
    }

    // —— 修改訂單 —— 
    if (msg.startsWith('修改訂單：')) {
      console.log('[order] 修改訂單流程啟動');
      const m = msg.match(/^修改訂單：(.+?)：(.+)$/);
      if (!m) {
        await reply(event, '⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」', config);
        return true;
      }
      const student = m[1].trim();
      const body    = m[2].trim();
      console.log('[order] 目標學生：', student, '新內容：', body);

      // 1) 負值抵消舊單
      const recs = config.orderRecords.filter(r => r.student === student);
      for (const r of recs) {
        const negItems = r.items.map(i => ({
          name:  i.name,
          qty:   -i.qty,
          price: i.price
        }));
        const negTotal = -r.total;
        console.log('[order] （修改）發送負值抵消單：', {
          student,
          items: negItems,
          total: negTotal,
          date:  r.date
        });
        await postToSheet(
          config.SHEETS_WEBAPP_URL,
          'order',
          { student, items: negItems, total: negTotal, date: r.date }
        );
      }
      // 清除記憶體
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);

      // 2) 下新單
      const result = await this._processLine(student, body, config);
      console.log('[order] 修改後新單結果：', result);
      await reply(event, `✅ 修改訂單完成：\n${result}`, config);
      return true;
    }

    // —— 一般下訂單 —— 
    const lines = msg.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)：(.+)$/.test(l));
    if (!orders.length) return false;

    console.log('[order] 一般訂單，共', orders.length, '行');
    const replies = [];
    for (const l of orders) {
      const [, student, body] = l.match(/^(.+?)：(.+)$/);
      replies.push(await this._processLine(student.trim(), body.trim(), config));
    }
    await reply(event, replies.join('\n'), config);
    return true;
  },

  // 內部：解析一行訂單並發送正值訂單
  async _processLine(student, rest, config) {
    // 1) 清理不要、不加
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
    const parts   = cleaned.split(/[＋+、,]/).map(p=>p.trim()).filter(Boolean);

    // 2) 處理每項
    const menus   = loadMenu(config.MENU_PATH);
    const items   = [];
    let total     = 0;
    const missing = [];

    for (let raw of parts) {
      let vendor = config.currentVendor, key = raw;
      const vm = raw.match(/^(.+?)-(.+)$/);
      if (vm && menus[vm[1].trim()]) {
        vendor = vm[1].trim();
        key    = vm[2].trim();
      }
      // 數量
      let qty = 1;
      const qm = key.match(/(.+?)x(\d+)$/i);
      if (qm) { key = qm[1]; qty = +qm[2]; }
      // 大／小 預設 key 即可
      let itemName = key;

      // 益伯特例
      let price = null;
      if (vendor === '益伯') {
        const r = yiBoParser.parse(key);
        if (r.price!=null) { itemName = r.itemName; price = r.price; }
      }
      if (price==null) price = menus[vendor]?.[itemName];
      if (price==null) {
        const {bestMatch,bestMatchIndex} =
          stringSimilarity.findBestMatch(itemName, Object.keys(menus[vendor]||{}));
        if (bestMatch.rating>0.6) {
          itemName = Object.keys(menus[vendor])[bestMatchIndex];
          price    = menus[vendor][itemName];
        }
      }
      if (price == null) { missing.push(raw); continue; }
      items.push({ name: itemName, qty, price });
      total += price * qty;
    }

    if (missing.length) {
      return `⚠️ ${student}：找不到 ${missing.join('、')}`;
    }

    // 3) 發送正值訂單
    const date = new Date().toISOString();
    console.log('[order] 發送正值訂單：', { student, items, total, date });
    config.orderRecords.push({ student, items, total, date });

    await postToSheet(
      config.SHEETS_WEBAPP_URL,
      'order',
      { student, items, total, date }
    );
    const detail = items.map(i=>`${i.name} x${i.qty}($${i.price})`).join(' + ');
    return `✅ ${student}：${detail}，共 $${total}`;
  }
};
