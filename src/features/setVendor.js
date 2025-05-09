/**
 * 功能：設定今日商家
 * 指令：今日商家：店名
 * 說明：將當日的下單商家設定為「店名」，並清空當天的訂單記憶。
 * 範例：
 *   今日商家：味道食堂
 */

const { reply, loadMenu } = require('../utils');

module.exports = {
  name: 'setVendor',
  async handle(event, config) {
    const msg = event.message.text.trim();
    const m = msg.match(/^今日商家[:：]\s*(.+)$/);
    if (!m) return false;

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);
    if (!menus[vendor]) {
      await reply(event, `⚠️ 找不到商家「${vendor}」，請確認名稱正確。`, config);
      return true;
    }

    // 設定當日商家（存在共享記憶體）
    config.currentVendor  = vendor;
    config.orderRecords   = [];

    await reply(event, `✅ 今日商家已設定為「${vendor}」`, config);
    return true;
  }
};
