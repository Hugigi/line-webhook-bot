/**
 * 功能：本月預收設定
 */

const { reply } = require('../utils');
const axios     = require('axios');

module.exports = {
  name: 'prepaid',
  async handle(event, config) {
    const msg = event.message.text.trim();

    // 1️⃣ 仅「本月預收」单独查询格式
    if (msg === '本月預收') {
      // 如果你的 Apps Script 支持查询预收，请替换以下 URL
      try {
        const res = await axios.get(`${config.SHEETS_WEBAPP_URL}?action=prepaid`);
        const data = res.data; // 假设 [{student, amount}, ...]
        const lines = data.map(r => `${r.student}：${r.amount} 元`).join('\n');
        await reply(event, `📊 本月預收：\n${lines}`, config);
      } catch (err) {
        console.error('❌ 本月預收 查詢失敗：', err.message);
        await reply(event, '⚠️ 本月預收 查詢失敗', config);
      }
      return true;
    }

    // 2️⃣ 「預收金額：學生  數字」 or 「學生本月預收數字」
    const p1 = msg.match(/^預收金額[:：]\s*(.+?)\s+(\d+)$/);
    const p2 = msg.match(/^(.+?)本月預收(\d+)$/);
    const m = p1 || p2;
    if (m) {
      const student = (p1 ? p1[1] : p2[1]).trim();
      const amount  = Number(p1 ? p1[2] : p2[2]);
      try {
        const res = await axios.post(config.SHEETS_WEBAPP_URL, {
          type:    'prepaid',
          student,
          amount
        });
        console.log(`→ [prepaid] HTTP ${res.status}`);
        await reply(event, `✅ ${student} 本月預收 ${amount}`, config);
      } catch (err) {
        console.error('❌ [prepaid] POST 錯誤：', err.message);
        await reply(event, '⚠️ 預收設定失敗', config);
      }
      return true;
    }

    return false;
  }
};
