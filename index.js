// index.js
// 1. 載入對應租戶的環境變數
const tenantId = process.env.TENANT_ID;
if (!tenantId) {
  console.error('❌ 請先設定 TENANT_ID 環境變數');
  process.exit(1);
}
require('dotenv').config({ path: `.env.${tenantId}` });

// 2. 載入各租戶設定
const path = require('path');
let config;
try {
  config = require(path.join(__dirname, 'config', 'tenants', tenantId + '.js'));
} catch (e) {
  console.error(`❌ 找不到租戶設定：config/tenants/${tenantId}.js`);
  process.exit(1);
}

// 3. 載入功能模組
const features = require(path.join(__dirname, 'src', 'features', 'index.js'));

// 4. 啟動 Express + LINE SDK
const express = require('express');
const line    = require('@line/bot-sdk');

const app = express();
app.use(express.json());

// 5. Webhook 路由
app.post(
  '/webhook',
  line.middleware({
    channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret:      config.LINE_CHANNEL_SECRET
  }),
  async (req, res) => {
    for (const ev of req.body.events) {
      if (ev.type === 'message' && ev.message.type === 'text') {
        for (const feat of features) {
          try {
            const handled = await feat.handle(ev, config);
            if (handled) break;
          } catch (err) {
            console.error(`Feature ${feat.name} 執行錯誤：`, err);
          }
        }
      }
    }
    return res.status(200).end();
  }
);

// 6. 啟動服務
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
