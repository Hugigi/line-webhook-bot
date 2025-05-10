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

    // 🛑 嚴格匹配正確格式「今日商家：XXX」
    const m = msg.match(/^今日商家[:：][\s]*([^\s]+)$/);

    if (!m) {
      console.log(`🛑 指令格式錯誤，不進行商家設定`);
      return false;  // 💡 確認格式錯誤時不應該執行
    }

    const vendor = m[1].trim();
    const menus  = loadMenu(config.MENU_PATH);

    // 🛑 如果商家名稱不在菜單中，回覆錯誤
    if (!menus[vendor]) {
      await reply(event, `⚠️ 找不到商家「${vendor}」，請確認名稱正確。`, config);
      console.log(`⚠️ 找不到商家「${vendor}」，指令忽略`);
      return false;  // 💡 這裡也改成 false，避免後續處理
    }

    // ✅ 設定當日商家（存在共享記憶體）
    config.currentVendor  = vendor;
    config.orderRecords   = [];

    console.log(`✅ 今日商家已設定為「${vendor}」`);
    await reply(event, `✅ 今日商家已設定為「${vendor}」`, config);
    return true;
  }
};
