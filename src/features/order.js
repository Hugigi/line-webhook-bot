// src/features/order.js
/**
 * 功能：下訂單／取消／修改（只回覆收到，不顯示細節）
 */
const stringSimilarity = require('string-similarity');
const yiBoParser       = require('../../parsers/yiBoParser');
const { reply, postToSheet, loadMenu } = require('../utils');

module.exports = {
  name: 'order',

  async handle(event, config) {
    const msg = event.message.text.trim();
    console.log('[order] 收到訊息：', msg);

    // 1️⃣ 如果未設定商家，提醒先設定
    if (!config.currentVendor) {
      await reply(event, '⚠️ 請先設定「今日商家：店名」，再進行下單。', config);
      return true;
    }

    // —— 取消訂單 ——
    if (msg.startsWith('取消訂單：')) {
      console.log('[order] 取消訂單流程');
      const student = msg.replace(/^取消訂單：/, '').trim();
      const recs = config.orderRecords.filter(r => r.student === student);
      if (!recs.length) {
        await reply(event, `⚠️ 找不到「${student}」的訂單。`, config);
        return true;
      }
      // 發送負值抵消
      for (const r of recs) {
        const negItems = r.items.map(i => ({ name: i.name, qty: -i.qty, price: i.price }));
        const negTotal = -r.total;
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: negTotal, date: r.date });
      }
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);
      await reply(event, `✅ 已取消「${student}」的訂單。`, config);
      return true;
    }

    // —— 修改訂單 ——
    if (msg.startsWith('修改訂單：')) {
      console.log('[order] 修改訂單流程');
      const m = msg.match(/^修改訂單：(.+?)：(.+)$/);
      if (!m) {
        await reply(event, '⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」。', config);
        return true;
      }
      const student = m[1].trim();
      const body    = m[2].trim();
      // 負值抵消
      const recs = config.orderRecords.filter(r => r.student === student);
      for (const r of recs) {
        const negItems = r.items.map(i => ({ name: i.name, qty: -i.qty, price: i.price }));
        const negTotal = -r.total;
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: negTotal, date: r.date });
      }
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);
      // 新單
      this._processLine(student, body, config).catch(err => console.error('[order] 修改後新單錯誤：', err));
      await reply(event, '✅ 修改訂單已收到', config);
      return true;
    }

    // —— 一般下訂單 ——
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)[:：].+/.test(l));
    if (!orders.length) return false;

    console.log('[order] 一般訂單', orders.length, '筆');
    // 只回覆收到
    await reply(event, '✅ 訂單已收到', config);
    // 背後非同步寫入
    for (const l of orders) {
      const [, student, body] = l.match(/^(.+?)[:：](.+)$/);
      this._processLine(student.trim(), body.trim(), config).catch(err => console.error('[order] 處理訂單錯誤：', err));
    }
    return true;
  },

  // 內部：解析一行並發送到試算表
  async _processLine(student, rest, config) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,，。]*/g, '').trim();
    const parts   = cleaned.split(/[＋+、,，]/).map(p => p.trim()).filter(Boolean);
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
      let qty = 1;
      const qm = key.match(/(.+?)x(\d+)$/i);
      if (qm) { key = qm[1]; qty = +qm[2]; }
      let itemName = key;
      let price    = null;
      if (vendor === '益伯') {
        const r = yiBoParser.parse(key);
        if (r.price != null) { itemName = r.itemName; price = r.price; }
      }
      if (price == null) price = menus[vendor]?.[itemName];
      if (price == null) {
        const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(itemName, Object.keys(menus[vendor]||{}));
        if (bestMatch.rating > 0.6) {
          itemName = Object.keys(menus[vendor])[bestMatchIndex];
          price    = menus[vendor][itemName];
        }
      }
      if (price == null) { missing.push(raw); continue; }
      items.push({ name: itemName, qty, price });
      total += price * qty;
    }

    if (missing.length) {
      console.warn('[order] 找不到項目：', missing);
      // 這裡直接忽略或另行記錄
    }

    const date = new Date().toISOString();
    config.orderRecords.push({ student, items, total, date });
    await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items, total, date });
  }
};
