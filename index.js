// index.js
console.log('▶️ 執行檔案：', __filename);

// 讀取環境變數
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

// 3️⃣ 建立 Express 應用
const app = express();
app.use(express.json());

// 4️⃣ 健康檢查
app.get('/health', (req, res) => {
  console.log('🟢 Health Check 成功');
  res.status(200).send('OK');
});

// 5️⃣ 測試 Google Apps Script 連接
app.get('/test-google-apps', async (req, res) => {
  try {
    const response = await axios.get(config.SHEETS_WEBAPP_URL);
    console.log(`🟢 Google Apps Script 成功連接：${response.status}`);
    res.status(200).send('Google Apps Script 連接成功');
  } catch (error) {
    console.error(`❌ Google Apps Script 連接失敗：${error.message}`);
    res.status(500).send('Google Apps Script 連接失敗');
  }
});

// 6️⃣ Webhook Debug Middleware
app.use('/webhook', (req, res, next) => {
  console.log('🔎 收到 Webhook 請求');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// 7️⃣ 驗證簽名 Middleware
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

// 8️⃣ 確認 Webhook 綁定
app.get('/webhook', (req, res) => {
  console.log('🟢 /webhook GET 成功');
  res.status(200).send('Webhook is active');
});

// 9️⃣ 處理 Webhook POST
app.post('/webhook', verifyMiddleware, async (req, res) => {
  console.log('🟢 /webhook POST 進入執行');

  if (!req.body.events) {
    console.error('❌ events 欄位缺失');
    return res.status(400).send('No events received');
  }

  for (const ev of req.body.events) {
    if (ev.type === 'message' && ev.message.type === 'text') {
      if (!ev.source || !ev.source.userId) {
        console.error('❌ ev.source 或 ev.source.userId 缺失');
        continue;
      }
      console.log(`📝 收到來自 ${ev.source.userId} 的訊息：${ev.message.text}`);

      let handled = false;
      for (const feat of features) {
        console.log(`⚙️ 嘗試執行功能：${feat.name}`);
        try {
          handled = await feat.handle(ev, config);
          if (handled) {
            console.log(`✅ 功能 ${feat.name} 成功執行`);
            break;
          }
        } catch (error) {
          console.error(`❌ Feature ${feat.name} 執行異常：`, error.message);
        }
      }
      if (!handled) console.log('🛑 無對應功能被執行');
    }
  }

  res.status(200).send('Webhook Processed');
});

// 10️⃣ (可選) 本地訂單記錄 Debug
app.get('/orders', (req, res) => {
  console.log('📝 查看 in‑memory 訂單記錄');
  res.json(config.orderRecords || []);
});

// 11️⃣ 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
