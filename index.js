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

// 3️⃣ 建立 Express 並啟用 JSON 解析
const app = express();
app.use(express.json());

// 4️⃣ 健康檢查端點
app.get('/health', (req, res) => {
  console.log('🟢 Health Check 成功');
  res.send('OK');
});

// 5️⃣ GET /webhook 確認 Webhook 綁定
app.get('/webhook', (req, res) => {
  console.log('🟢 /webhook GET 成功');
  res.send('Webhook is active');
});

// 6️⃣ Webhook POST 處理及簽名驗證
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

// 中介層 Debug：打印收到的原始請求
app.use('/webhook', (req, res, next) => {
  console.log('🔎 收到 Webhook 請求');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

app.post('/webhook', verifyMiddleware, async (req, res) => {
  console.log('🟢 強制進入 /webhook POST');

  if (!req.body.events) {
    console.error('❌ events 沒有被接收到');
    return res.status(400).send('No events received');
  }

  for (const ev of req.body.events) {
    if (ev.type === 'message' && ev.message.type === 'text') {
      if (!ev.source || !ev.source.userId) {
        console.error('❌ ev.source 或 ev.source.userId 是 undefined');
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
        } catch (innerErr) {
          console.error(`❌ Feature ${feat.name} 執行錯誤：`, innerErr.message);
        }
      }

      if (!handled) console.log('🛑 無對應功能被執行');
    }
  }

  res.send('Webhook Processed');
});

// 7️⃣ Google Apps Script 測試
app.get('/test-google-apps', async (req, res) => {
  try {
    const response = await axios.get(config.SHEETS_WEBAPP_URL);
    console.log(`🟢 Google Apps Script 成功連接：${response.status}`);
    res.send('Google Apps Script 連接成功');
  } catch (error) {
    console.error(`❌ Google Apps Script 連接失敗：${error.message}`);
    res.status(500).send('Google Apps Script 連接失敗');
  }
});

// 8️⃣ 啟動 HTTP Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
