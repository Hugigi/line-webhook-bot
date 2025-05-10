""/**
 * 功能：顯示菜單
 * 指令：店名菜單
 * 說明：回傳指定店家的所有品項與價格。
 * 範例：
 *   阿明牛肉麵菜單
 */

const { reply, loadMenu } = require('../utils');

module.exports = {
  name: 'showMenu',
  async handle(event, config) {
    const msg = event.message.text.trim();
    const m = msg.match(/^(.+?)的?菜單$/);

    // 檢查是否有符合的菜單指令
    if (!m) return false;

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);

    if (!menus[vendor]) {
      console.log(`⚠️ 找不到商家「${vendor}」的菜單。`);
      await reply(event, `⚠️ 找不到商家「${vendor}」的菜單。`, config);
      return true;
    }

    const lines = Object.entries(menus[vendor])
      .map(([name, price]) => `${name}：$${price}`)
      .join('
');

    console.log(`✅ 顯示 ${vendor} 的菜單：
${lines}`);
    await reply(event, `「${vendor}」菜單：
${lines}`, config);
    return true;
  }
};
""
