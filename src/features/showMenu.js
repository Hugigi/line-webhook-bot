/**
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

    // 🛑 嚴格匹配格式「XXX的菜單」或「XXX菜單」
    const m = msg.match(/^([^\s]+?)(的)?菜單$/);

    if (!m) {
      console.log(`🛑 指令格式錯誤，不進行菜單顯示`);
      return false;
    }

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);

    if (!menus[vendor]) {
      console.log(`⚠️ 找不到商家「${vendor}」的菜單`);
      await reply(event, `⚠️ 找不到商家「${vendor}」的菜單。`, config);
      return true;
    }

    const lines = Object.entries(menus[vendor])
      .map(([name, price]) => `${name}：$${price}`)
      .join('\n');

    console.log(`✅ 顯示 ${vendor} 的菜單：\n${lines}`);
    await reply(event, `「${vendor}」菜單：\n${lines}`, config);
    return true;
  }
};
