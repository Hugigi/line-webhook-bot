// index.js
console.log('▶️ 執行檔案：', __filename);

// 讀 dotenv
require('dotenv').config({ path: `.env.${process.env.TENANT_ID}` });

const express = require('express');
const line    = require('@line/bot-sdk');
const path    = require('path');
const axios   = require('axios');

// 1️⃣ 載入租戶設定
const tenantId = process.env.TENANT_ID;
if (!tenantId) {
  console.error('❌ 請先設定 TENANT_ID');
  process.exit(1);
}
let config;
try {
  config = require(path.join(__dirname, 'config', 'tenants', tenantId + '.js'));
  console.log(`✅ 成功載入租戶設定: ${tenantId}`);
} catch (e) {
  console.error(`❌ 找不到 config/tenants/${tenantId}.js`);
  process.exit(1);
}

// 2️⃣ 載入功能模組
const features = require('./src/features');
console.log('[features] 載入功能：', features.map(f => f.name));

// 3️⃣ 建立 Express，啟用 JSON 解析
const app = express();
app.use(express.json());

// 4️⃣ 健康檢查端點（可選）
app.get('/health', (req, res) => {
  console.log('🟢 Health Check 成功');
  res.status(200).send('OK');
});

// 5️⃣ 簽名驗證中介：production 才驗，開發跳過
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

// 6️⃣ Webhook 調試 Middleware：紀錄每次請求
app.use('/webhook', (req, res, next) => {
  console.log('🔎 收到 Webhook 請求：');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// 7️⃣ GET /webhook → 檢查綁定
app.get('/webhook', (req, res) => {
  console.log('🟢 GET /webhook');
  res.status(200).send('Webhook is active');
});

// 8️⃣ POST /webhook → 處理事件
app.post('/webhook', verifyMiddleware, async (req, res) => {
  const events = req.body.events || [];
  for (const ev of events) {
    if (ev.type === 'message' && ev.message.type === 'text' && ev.source?.userId) {
      console.log(`📝 收到來自 ${ev.source.userId} 的訊息：${ev.message.text}`);
      let handled = false;
      for (const feat of features) {
        try {
          handled = await feat.handle(ev, config);
          if (handled) {
            console.log(`✅ 功能 ${feat.name} 處理完成`);
            break;
          }
        } catch (err) {
          console.error(`❌ Feature ${feat.name} 執行錯誤：`, err.message);
        }
      }
      if (!handled) {
        console.log('🛑 無對應功能被執行');
      }
    }
  }
  res.status(200).end();
});

// 9️⃣ Google Apps Script 測試（可選）
app.get('/test-google-apps', async (req, res) => {
  try {
    const r = await axios.get(config.SHEETS_WEBAPP_URL);
    console.log(`🟢 Google Apps Script 回傳 ${r.status}`);
    res.status(200).send('Google Apps Script 連線成功');
  } catch (err) {
    console.error(`❌ Google Apps Script 失敗：`, err.message);
    res.status(500).send('Google Apps Script 連線失敗');
  }
});

// 10️⃣ 本地 orders 查看（可選）
app.get('/orders', (req, res) => {
  res.json(config.orderRecords || []);
});

// 11️⃣ 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
