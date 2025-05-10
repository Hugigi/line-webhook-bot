// index.js
require('dotenv').config({ path: `.env.${process.env.TENANT_ID}` });

const express = require('express');
const line    = require('@line/bot-sdk');
const path    = require('path');
const axios   = require('axios');

console.log('▶️ 執行檔案：', __filename);

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

// 3️⃣ 建立 Express
const app = express();
app.use(express.json());

// 4️⃣ 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 5️⃣ 設定 webhook 的 POST
const verifyMiddleware = line.middleware({
  channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      config.LINE_CHANNEL_SECRET
});

app.post('/webhook', verifyMiddleware, async (req, res) => {
  try {
    for (const ev of req.body.events) {
      if (ev.type === 'message' && ev.message.type === 'text') {
        
        // ✅ 增加檢查 ev.source 是否存在
        if (!ev.source || !ev.source.userId) {
          console.error('❌ ev.source 或 ev.source.userId 是 undefined');
          continue;
        }

        console.log(`📝 收到來自 ${ev.source.userId} 的訊息：${ev.message.text}`);
        
        // 📝 嘗試執行所有功能模組
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

        if (!handled) {
          console.log('🛑 無對應功能被執行');
        }
      }
    }
    res.status(200).send('Webhook Processed');
  } catch (err) {
    console.error('❌ 發生未捕捉的錯誤:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

// 6️⃣ Google Apps Script 測試
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

// 7️⃣ 啟動 HTTP Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
