/**
 * 功能：下訂單／取消訂單／修改訂單
 * 指令：
 *   1. 下訂單：學生A：品項＋數量（可多行）
 *   2. 取消訂單：取消訂單：學生A、學生B
 *   3. 修改訂單：修改訂單：學生A：新品項＋數量
 * 說明：
 *   - 解析學生姓名、品項、大/小、數量與加料/不加註記
 *   - 回覆訂單明細與小計，並寫入當日工作表
 * 範例：
 *   小明：鍋燒意麵＋滷蛋×2
 *   取消訂單：小明
 *   修改訂單：小明：牛肉湯×1
 */

const stringSimilarity = require('string-similarity');
const yiBoParser = require('../../parsers/yiBoParser');
const { reply, postToSheet, loadMenu } = require('../utils');

module.exports = {
  name: 'order',
  async handle(event, config) {
    const msg = event.message.text.trim();
    let m;

    // 1) 取消訂單
    if (m = msg.match(/^取消訂單[:：]\s*(.+)$/)) {
      const students = m[1]
        .split(/[、,]/)
        .map(s => s.trim())
        .filter(Boolean);
      const results = [];
      for (const student of students) {
        const before = config.orderRecords.length;
        config.orderRecords = config.orderRecords.filter(o => o.student !== student);
        const ok = await postToSheet(config.SHEETS_WEBAPP_URL, 'cancel', { student });
        results.push(
          before === config.orderRecords.length
            ? `⚠️ 找不到「${student}」的訂單`
            : ok
              ? `✅ 已取消「${student}」的訂單`
              : `✅ 已取消「${student}」但同步刪除失敗`
        );
      }
      await reply(event, results.join('\n'), config);
      return true;
    }

    // 2) 修改訂單
    if (m = msg.match(/^修改訂單[:：]\s*(.+?)[:：]\s*(.+)$/)) {
      const student = m[1].trim();
      config.orderRecords = config.orderRecords.filter(o => o.student !== student);
      await postToSheet(config.SHEETS_WEBAPP_URL, 'cancel', { student });
      // 跳到下訂單流程
      return this._processLine(event, `${student}：${m[2]}`, config);
    }

    // 3) 下訂單（支援多行）
    const lines = msg.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const orderLines = lines.filter(l => /^(.+?)[:：]\s*(.+)$/.test(l));
    if (!orderLines.length) return false;

    const replies = [];
    for (const line of orderLines) {
      replies.push(await this._processLine(event, line, config));
    }
    await reply(event, replies.join('\n'), config);
    return true;
  },

  // 處理單行訂單的內部方法
  async _processLine(event, line, config) {
    const [, student, rest] = line.match(/^(.+?)[:：]\s*(.+)$/);
    // 1) 清理「不要」「不加」註記
    const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
    // 2) 拆分各品項
    const parts = cleaned.split(/[＋+、,]/).map(p => p.trim()).filter(Boolean);

    const menus = loadMenu(config.MENU_PATH);
    const items = [];
    let total = 0;
    const missing = [];

    for (let raw of parts) {
      // 2a) 跨店家檢測 vendor-item
      let vendor = config.currentVendor;
      let key = raw;
      const vm = raw.match(/^(.+?)[-–](.+)$/);
      if (vm && menus[vm[1].trim()]) {
        vendor = vm[1].trim();
        key    = vm[2].trim();
      }
      // 2b) 數量偵測
      let qty = 1;
      const qm = key.match(/(.+?)\s*[xX*]\s*(\d+)$/);
      if (qm) {
        key = qm[1].trim();
        qty = parseInt(qm[2], 10);
      }
      // 2c) 大/小偵測
      let itemName = key;
      let m;
      if (m = key.match(/^(.+?)[（(](大|小)[）)]$/)) {
        itemName = `${m[2]}${m[1]}`;
      } else if (/^[大小]/.test(key) || /[大小]$/.test(key)) {
        itemName = key;
      }
      // 2d) 查價格
      const menu = menus[vendor] || {};
      let price = null;
      if (vendor === '益伯') {
        const r = yiBoParser.parse(key);
        if (r.price != null) {
          itemName = r.itemName;
          price    = r.price;
        }
      }
      if (price == null) price = menu[itemName];
      if (price == null && Object.keys(menu).length) {
        const { bestMatch, bestMatchIndex } =
          stringSimilarity.findBestMatch(itemName, Object.keys(menu));
        if (bestMatch.rating > 0.6) {
          itemName = Object.keys(menu)[bestMatchIndex];
          price    = menu[itemName];
        }
      }
      if (price == null) {
        missing.push(raw);
        continue;
      }

      items.push({ name: itemName, qty, price });
      total += price * qty;
    }

    if (missing.length) {
      return `⚠️ ${student}：找不到 ${missing.join('、')}`;
    }

    // 記憶體存單
    const date = new Date().toISOString();
    config.orderRecords.push({ student, items, total, date });

    // 寫入試算表
    const ok = await postToSheet(
      config.SHEETS_WEBAPP_URL,
      'order',
      { student, items, total, date }
    );

    const detail = items.map(i => `${i.name} x${i.qty}($${i.price})`).join(' + ');
    return ok
      ? `✅ ${student}：${detail}，共 $${total}`
      : `✅ ${student}：${detail}，共 $${total}\n⚠️ 訂單寫入失敗，請稍後再試`;
  }
};
