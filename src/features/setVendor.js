/**
 * 功能：設定今日商家
 * 指令：今日商家：店名
 */

const { reply, loadMenu } = require('../utils');

module.exports = {
  name: 'setVendor',
  async handle(event, config) {
    const msg = event.message.text.trim();
    // 嚴格匹配「今日商家：XXX」格式
    const m = msg.match(/^今日商家[:：]\s*(.+)$/);
    if (!m) return false;

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);
    if (!menus[vendor]) {
      await reply(event, `⚠️ 找不到商家「${vendor}」。`, config);
      return true;
    }

    config.currentVendor = vendor;
    config.orderRecords  = [];
    await reply(event, `✅ 今日商家已設定為「${vendor}」`, config);
    return true;
  }
};
