// config/tenants/shan-hua.js
module.exports = {
  TENANT_ID: process.env.TENANT_ID,                             // 'shan-hua'
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET:      process.env.LINE_CHANNEL_SECRET,
  SHEETS_WEBAPP_URL:        process.env.SHEETS_WEBAPP_URL,
  MENU_PATH:                process.env.MENU_PATH,              // './src/menus/shan-hua.json'
  ENABLED_FEATURES:         process.env.ENABLED_FEATURES
                              .split(',')                        // ['order', ...]
                              .map(f => f.trim())
};
