/**
 * 功能：今日訂單統整
 * 指令：今日訂單
 * 說明：統整並回傳今天所有訂單的品項與累計數量（不顯示個人明細）。
 * 範例：
 *   今日訂單
 */

const { reply } = require('../utils');

module.exports = {
  name: 'dailyReport',
  async handle(event, config) {
    const msg = event.message.text.trim();
    if (msg !== '今日訂單') return false;

    const orders = config.orderRecords || [];
    if (orders.length === 0) {
      await reply(event, '目前無任何訂單', config);
      return true;
    }

    // 累計各品項數量
    const summary = {};
    orders.forEach(({ items }) => {
      items.forEach(({ name, qty }) => {
        summary[name] = (summary[name] || 0) + qty;
      });
    });

    // 組成回覆文字
    const lines = Object.entries(summary)
      .map(([name, total]) => `${name}：${total}`)
      .join('\n');
    await reply(event, `📋 今日訂單統整：\n${lines}`, config);
    return true;
  }
};
