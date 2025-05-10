// index.js
console.log('▶️ 執行檔案：', __filename);

// 讀 dotenv
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
const config = require(path.join(__dirname, 'config', 'tenants', tenantId + '.js'));

// 2️⃣ 載入功能模組
const features = require('./src/features');
console.log('[features] 載入功能：', features.map(f => f.name));

// 3️⃣ 建立 Express
const app = express();
app.use(express.json());

// 4️⃣ 確認 Webhook 綁定
app.get('/webhook', (req, res) => {
  console.log('🟢 GET /webhook');
  res.send('Webhook is active');
});

// 5️⃣ 設定簽名驗證 Middleware（production 才驗，開發時跳過）
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

// 6️⃣ 處理 Webhook 事件
app.post('/webhook', verifyMiddleware, async (req, res) => {
  const events = req.body.events || [];
  for (const ev of events) {
    if (ev.type === 'message' && ev.message.type === 'text' && ev.source?.userId) {
      console.log(`📝 收到 ${ev.source.userId} 訊息：${ev.message.text}`);
      for (const feat of features) {
        try {
          const handled = await feat.handle(ev, config);
          if (handled) {
            console.log(`✅ ${feat.name} 處理完成`);
            break;
          }
        } catch (err) {
          console.error(`❌ ${feat.name} 執行錯誤：`, err.message);
        }
      }
    }
  }
  res.status(200).end();
});

// 7️⃣ 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
