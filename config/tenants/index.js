// config/tenants/index.js
const path = require('path');
const tenantId = process.env.TENANT_ID;

if (!tenantId) {
  throw new Error('環境變數 TENANT_ID 未設定');
}

try {
  module.exports = require(path.join(__dirname, tenantId + '.js'));
} catch (e) {
  throw new Error(`找不到租戶設定檔 config/tenants/${tenantId}.js`);
}
