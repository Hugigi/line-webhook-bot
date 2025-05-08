/**
 * 功能：本月預收設定
 * 指令：
 *   1. 預收金額：學生A 300
 *   2. 學生A本月預收300
 * 說明：設定或更新指定學生本月的預收金額，寫入「彙整」C 欄。
 * 範例：
 *   預收金額：小華 500
 *   小華本月預收800
 */

const { reply, postToSheet } = require('../utils');

module.exports = {
  name: 'prepaid',
  async handle(event, config) {
    const msg = event.message.text.trim();
    const m = msg.match(/^預收金額[:：]\s*(.+?)\s+(\d+)$/)
           || msg.match(/^(.+?)本月預收(\d+)$/);
    if (!m) return false;

    const student = m[1].trim();
    const amount  = Number(m[2]);
    const ok = await postToSheet(
      config.SHEETS_WEBAPP_URL,
      'prepaid',
      { student, amount }
    );

    await reply(
      event,
      ok
        ? `✅ 已設定 ${student} 本月預收 ${amount} 元`
        : `⚠️ 設定預收失敗，請稍後再試`,
      config
    );
    return true;
  }
};
