/**
 * 功能：顯示菜單
 * 指令：店名菜單 或 店名的菜單
 */

const { reply, loadMenu } = require('../utils');

module.exports = {
  name: 'showMenu',
  async handle(event, config) {
    const msg = event.message.text.trim();
    // 只匹配「XXX菜單」或「XXX的菜單」
    const m = msg.match(/^(.+?)(?:的)?菜單$/);
    if (!m) return false;

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);
    if (!menus[vendor]) {
      await reply(event, `⚠️ 找不到商家「${vendor}」的菜單。`, config);
      return true;
    }

    const lines = Object.entries(menus[vendor])
      .map(([name, price]) => `${name}：$${price}`)
      .join('\n');
    await reply(event, `「${vendor}」菜單：\n${lines}`, config);
    return true;
  }
};
