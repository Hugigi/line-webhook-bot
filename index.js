// index.js
console.log('▶️ 執行檔案：', __filename);

// 讀取環境變數
require('dotenv').config({ path: `.env.${process.env.TENANT_ID}` });

const express = require('express');
const line    = require('@line/bot-sdk');
const path    = require('path');

// 1️⃣ 載入租戶設定
const tenantId = process.env.TENANT_ID;
if (!tenantId) {
  console.error('❌ 請先設定 TENANT_ID');
  process.exit(1);
}
const configPath = path.join(__dirname, 'config', 'tenants', `${tenantId}.js`);
let config;
try {
  config = require(configPath);
  console.log(`✅ 成功載入租戶設定: ${tenantId}`);
} catch (e) {
  console.error(`❌ 找不到租戶設定檔: ${configPath}`);
  process.exit(1);
}

// 2️⃣ 載入功能模組
const features = require('./src/features');
console.log('[features] 載入功能：', features.map(f => f.name));

// 3️⃣ 建立 Express 應用，保留 rawBody 供簽名驗證
const app = express();
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// 4️⃣ 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 5️⃣ GET /webhook 測試連線
app.get('/webhook', (req, res) => {
  console.log('🟢 GET /webhook');
  res.status(200).send('Webhook is active');
});

// 6️⃣ 簽名驗證 Middleware（production 環境才開啟）
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

// 7️⃣ 處理 Webhook 事件
app.post('/webhook', verifyMiddleware, async (req, res) => {
  const events = Array.isArray(req.body.events) ? req.body.events : [];
  for (const ev of events) {
    if (ev.type === 'message' && ev.message.type === 'text' && ev.source && ev.source.userId) {
      console.log(`📝 收到 ${ev.source.userId} 訊息：${ev.message.text}`);
      for (const feat of features) {
        try {
          const handled = await feat.handle(ev, config);
          if (handled) {
            console.log(`✅ ${feat.name} 完成`);
            break;
          }
        } catch (err) {
          console.error(`❌ ${feat.name} 執行錯誤：`, err);
        }
      }
    }
  }
  res.status(200).end();
});

// 8️⃣ 啟動 HTTP Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
