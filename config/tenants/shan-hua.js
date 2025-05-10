// config/tenants/shan-hua.js
module.exports = {
  // 這幾個還是從 .env.shan-hua 拿
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET:      process.env.LINE_CHANNEL_SECRET,
  SHEETS_WEBAPP_URL:        process.env.SHEETS_WEBAPP_URL,

  // 以下不用 env，寫在這裡以後不會動
  MENU_PATH: './menus',
  ENABLED_FEATURES: [
    'setVendor',
    'showMenu',
    'order',
    'dailyReport',
    'prepaid',
    'queryMonth',
    'recalc'
  ],

  // 記憶體初始值
  currentVendor:  null,
  orderRecords:   []
};
