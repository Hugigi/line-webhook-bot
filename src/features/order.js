// src/features/order.js
/**
 * 功能：下訂單／取消／修改（錯誤時提示、缺失品項回報、成功時簡短回覆並記錄詳細）
 */
const stringSimilarity = require('string-similarity');
const yiBoParser       = require('../../parsers/yiBoParser');
const { reply, postToSheet, loadMenu } = require('../utils');

module.exports = {
  name: 'order',

  async handle(event, config) {
    const msg = event.message.text.trim();
    console.log('[order] 收到訊息：', msg);

    // 1️⃣ 未設定商家
    if (!config.currentVendor) {
      await reply(event, '⚠️ 請先設定「今日商家：店名」，再進行下訂單。', config);
      return true;
    }

    // 載入扁平化菜單
    const allMenus = loadMenu(config.MENU_PATH);
    const menuMap  = allMenus[config.currentVendor] || {};

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
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', {
          student,
          items: negItems,
          total: -r.total,
          date:  r.date
        });
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
      // 負值抵消舊單
      const recs = config.orderRecords.filter(r => r.student === student);
      for (const r of recs) {
        const negItems = r.items.map(i => ({ name: i.name, qty: -i.qty, price: i.price }));
        await postToSheet(config.SHEETS_WEBAPP_URL, 'order', {
          student,
          items: negItems,
          total: -r.total,
          date:  r.date
        });
      }
      config.orderRecords = config.orderRecords.filter(r => r.student !== student);

      // 檢測缺失
      const error = this._detectMissing(body, menuMap);
      if (error) {
        await reply(event, `⚠️ ${student}：${error}`, config);
      } else {
        // 下新單
        await this._processLine(student, body, config, menuMap);
        await reply(event, '✅ 修改訂單已收到', config);
      }
      return true;
    }

    // —— 一般下訂單 ——
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orders = lines.filter(l => /^(.+?)[:：].+/.test(l));
    if (!orders.length) return false;

    // 檢測缺失
    for (const line of orders) {
      const [, student, body] = line.match(/^(.+?)[:：](.+)$/);
      const error = this._detectMissing(body.trim(), menuMap);
      if (error) {
        await reply(event, `⚠️ ${student}：${error}`, config);
        return true;
      }
    }

    // 成功簡短回覆
    await reply(event, '✅ 訂單已收到', config);
    // 非同步發送詳細訂單
    for (const line of orders) {
      const [, student, body] = line.match(/^(.+?)[:：](.+)$/);
      this._processLine(student.trim(), body.trim(), config, menuMap)
        .catch(e => console.error('[order] 處理訂單錯誤：', e));
    }
    return true;
  },

  /**
   * 檢測缺失品項：先精準匹配，再益伯解析，最後模糊比對
   */
  _detectMissing(rest, menuMap) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,，。]*/g, '').trim();
    const parts   = cleaned.split(/[＋+、,，]/).map(p => p.trim()).filter(Boolean);
    const missing = [];
    const names   = Object.keys(menuMap);

    for (const key of parts) {
      if (menuMap[key] != null) continue;
      // 益伯特例
      const r = yiBoParser.parse(key);
      if (r.price != null) continue;
      // 模糊比對
      const { bestMatch } = stringSimilarity.findBestMatch(key, names);
      if (bestMatch.rating <= 0.6) missing.push(key);
    }

    return missing.length ? `找不到 ${missing.join('、')}` : null;
  },

  /**
   * 真正送出訂單到試算表並記憶
   */
  async _processLine(student, rest, config, menuMap) {
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,，。]*/g, '').trim();
    const parts   = cleaned.split(/[＋+、,，]/).map(p => p.trim()).filter(Boolean);
    const items   = [];
    let total     = 0;

    for (const rawKey of parts) {
      let itemName = rawKey;
      let price    = menuMap[rawKey];
      if (config.currentVendor === '益伯' && price == null) {
        const r = yiBoParser.parse(rawKey);
        if (r.price != null) { itemName = r.itemName; price = r.price; }
      }
      price = price != null ? price : 0;
      items.push({ name: itemName, qty: 1, price });
      total += price;
    }

    const date = new Date().toISOString();
    config.orderRecords.push({ student, items, total, date });
    await postToSheet(config.SHEETS_WEBAPP_URL, 'order', { student, items, total, date });
  }
};
