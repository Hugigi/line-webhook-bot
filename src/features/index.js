// src/features/index.js

const config = require('../../config/tenants');

const allFeats = {
  setVendor:   require('./setVendor'),
  showMenu:    require('./showMenu'),
  order:       require('./order'),
  prepaid:     require('./prepaid'),
  queryMonth:  require('./queryMonth'),
  dailyReport: require('./dailyReport'),
  // 未來要加的功能模組放這裡
};

// 根據租戶設定的 ENABLED_FEATURES 陣列，挑出要載入的 modules
const features = config.ENABLED_FEATURES
  .map(name => {
    const feat = allFeats[name];
    if (!feat) {
      console.warn(`⚠️ Feature "${name}" 不存在，請確認 config/tenants/${config.TENANT_ID}.js 裡 ENABLED_FEATURES`);
    }
    return feat;
  })
  .filter(Boolean);

// **在這裡加上 debug log**
console.log('[features] 載入功能：', features.map(f => f.name));

module.exports = features;
