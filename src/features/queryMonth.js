/**
 * 功能：本月餐費／本月餘額查詢
 * 指令：
 *   本月餐費
 *   本月餘額
 * 說明：查詢並列出所有學生本月累計花費（expense）或餘額（balance），顯示於 LINE 回覆。
 * 範例：
 *   本月餐費
 *   本月餘額
 */

const fetch = require('node-fetch');
const { reply } = require('../utils');

module.exports = {
  name: 'queryMonth',
  async handle(event, config) {
    const msg = event.message.text.trim();
    if (msg !== '本月餐費' && msg !== '本月餘額') return false;

    const action = msg === '本月餐費' ? 'expense' : 'balance';
    try {
      const res  = await fetch(`${config.SHEETS_WEBAPP_URL}?action=${action}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        await reply(event, '目前無任何紀錄', config);
      } else {
        const lines = data.map(r => `${r.student}：${r.value} 元`).join('\n');
        await reply(event, `📊 ${msg}：\n${lines}`, config);
      }
    } catch {
      await reply(event, '⚠️ 查詢失敗，請稍後再試', config);
    }
    return true;
  }
};
