// src/features/index.js
const allFeats = {
  setVendor:   require('./setVendor'),
  showMenu:    require('./showMenu'),
  prepaid:     require('./prepaid'),
  order:       require('./order'),
  dailyReport: require('./dailyReport'),
  queryMonth:  require('./queryMonth'),
  // 未来新功能再加这里
};

// **固定顺序**：先设商家 / 看菜单 / 预收 / 下单 / 日报 / 本月查询
const loadOrder = [
  'setVendor',
  'showMenu',
  'prepaid',
  'order',
  'dailyReport',
  'queryMonth'
];

const features = loadOrder
  .map(name => {
    const f = allFeats[name];
    if (!f) console.warn(`⚠️ Feature "${name}" 不存在`);
    return f;
  })
  .filter(Boolean);

console.log('[features] 載入功能顺序：', features.map(f => f.name));
module.exports = features;
