// src/features/order.js
/**
 * 功能：下訂單／取消／修改（錯誤時提示、缺失品項回報、成功時簡短回覆）
 */
const stringSimilarity = require('string-similarity');
const yiBoParser       = require('../../parsers/yiBoParser');
const { reply, postToSheet, loadMenu } = require('../utils');

module.exports = {
  name: 'order',

  async handle(event, config) {
    const msg = event.message.text.trim();
    console.log('[order] 收到訊息：', msg);

    // 1️⃣ 未設定商家，提醒
    if (!config.currentVendor) {
      await reply(event, '⚠️ 請先設定「今日商家：店名」，再進行下單。', config);
      return true;
    }

    // —— 取消訂單 ——
    if (msg.startsWith('取消訂單：')) {
      const student = msg.slice(5).trim();
      const recs = config.orderRecords.filter(r => r.student === student);
      if (!recs.length) {
        await reply(event, `⚠️ 找不到「${student}」的訂單。`, config);
        return true;
      }
      for (const r of recs) {
        const negItems = r.items.map(i => ({ name: i.name, qty: -i.qty, price: i.price }));
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: -r.total, date: r.date });
      }
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);
      await reply(event, `✅ 已取消「${student}」的訂單。`, config);
      return true;
    }

    // —— 修改訂單 ——
    if (msg.startsWith('修改訂單：')) {
      const m = msg.match(/^修改訂單：(.+?)：(.+)$/);
      if (!m) {
        await reply(event, '⚠️ 格式錯誤，請輸入「修改訂單：學生A：品項＋數量」。', config);
        return true;
      }
      const [, student, body] = m;
      const recs = config.orderRecords.filter(r => r.student === student);
      for (const r of recs) {
        const negItems = r.items.map(i => ({ name: i.name, qty: -i.qty, price: i.price }));
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items: negItems, total: -r.total, date: r.date });
      }
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);

      const error = this._detectMissing(student, body, config);
      if (error) {
        await reply(event, error, config);
      } else {
        this._processLine(student, body, config).catch(e => console.error('[order] 修改後新單錯誤：', e));
        await reply(event, '✅ 修改訂單已收到', config);
      }
      return true;
    }

    // —— 一般下訂單 ——
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)[:：].+/.test(l));
    if (!orders.length) return false;

    // 2️⃣ 檢查缺失
    for (const line of orders) {
      const [, student, body] = line.match(/^(.+?)[:：](.+)$/);
      const error = this._detectMissing(student.trim(), body.trim(), config);
      if (error) {
        await reply(event, error, config);
        return true;
      }
    }

    // 3️⃣ 成功簡短回覆
    await reply(event, '✅ 訂單已收到', config);
    for (const line of orders) {
      const [, student, body] = line.match(/^(.+?)[:：](.+)$/);
      this._processLine(student.trim(), body.trim(), config)
        .catch(e => console.error('[order] 處理訂單錯誤：', e));
    }
    return true;
  },

  // 檢測缺失品項
  _detectMissing(student, rest, config) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,，。]*/g, '').trim();
    const parts   = cleaned.split(/[＋+、,，]/).map(p => p.trim()).filter(Boolean);
    const menus   = loadMenu(config.MENU_PATH);
    const missing = [];
    for (const raw of parts) {
      let key = raw;
      if (menus[config.currentVendor]?.[key]) continue;
      const r = yiBoParser.parse(key);
      if (r.price != null) continue;
      const { bestMatch } = stringSimilarity.findBestMatch(key, Object.keys(menus[config.currentVendor]||{}));
      if (bestMatch.rating <= 0.6) missing.push(raw);
    }
    if (missing.length) {
      return `⚠️ ${student}：找不到 ${missing.join('、')}`;
    }
    return null;
  },

  // 實際發送至試算表
  async _processLine(student, rest, config) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,，。]*/g, '').trim();
    const parts   = cleaned.split(/[＋+、,，]/).map(p => p.trim()).filter(Boolean);
    const menus   = loadMenu(config.MENU_PATH);
    const items   = [];
    let total     = 0;
    for (const raw of parts) {
      let vendor = config.currentVendor;
      let key    = raw;
      const vm = raw.match(/^(.+?)-(.+)$/);
      if (vm && menus[vm[1].trim()]) { vendor = vm[1].trim(); key = vm[2].trim(); }
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
      items.push({ name: itemName, qty, price });
      total += price * qty;
    }
    const date = new Date().toISOString();
    config.orderRecords.push({ student, items, total, date });
    await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items, total, date });
  }
};
