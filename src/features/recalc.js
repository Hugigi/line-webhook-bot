// src/features/recalc.js
const axios = require('axios');
const { reply } = require('../utils');

module.exports = {
  name: 'recalc',
  async handle(event, config) {
    const msg = event.message.text.trim();
    if (msg !== '重算本月') return false;

    try {
      const res = await axios.get(`${config.SHEETS_WEBAPP_URL}?action=recalc`);
      console.log('[recalc] HTTP', res.status, 'data:', res.data);
      if (res.status === 200) {
        await reply(event, '✅ 已重新計算本月所有資料', config);
      } else {
        await reply(event, '⚠️ 重算本月失敗，請稍後再試', config);
      }
    } catch (err) {
      console.error('❌ recalc 執行錯誤：', err.message);
      await reply(event, '⚠️ 重算本月出錯，請聯絡管理員', config);
    }
    return true;
  }
};
