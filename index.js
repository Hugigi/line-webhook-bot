// index.js
// 先印出目前執行的檔案路徑，確定 node 執行到這裡
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
let config;
try {
  config = require(path.join(__dirname, 'config', 'tenants', tenantId + '.js'));
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

// 4️⃣ 建立 /webhook 路由（開發時可先跳過簽章驗證）
const verifyMiddleware = process.env.NODE_ENV === 'production'
  ? line.middleware({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret:      config.LINE_CHANNEL_SECRET
    })
  : (req, res, next) => next();

app.post('/webhook', verifyMiddleware, async (req, res) => {
  console.log('📨 收到事件:', JSON.stringify(req.body.events));
  for (const ev of req.body.events) {
    if (ev.type === 'message' && ev.message.type === 'text') {
      for (const feat of features) {
        try {
          const handled = await feat.handle(ev, config);
          if (handled) break;
        } catch (err) {
          console.error(`❌ Feature ${feat.name} 執行錯誤：`, err);
        }
      }
    }
  }
  res.status(200).end();
});

// 5️⃣ 本地 debug：查看 in‐memory 訂單
app.get('/orders', (req, res) => {
  res.json(config.orderRecords || []);
});

// 6️⃣ 啟動 HTTP Server
const PORT = process.env.PORT;

// 🔎 新增一個 Health Check API
app.get('/health', (req, res) => {
  res.status(200).send('OK');
  console.log("🟢 Health Check 通過");
});

// 🔎 新增一個 Debug Route 看看 Server 是否正常跑
app.get('/', (req, res) => {
  res.status(200).send('Render 伺服器運行正常');
  console.log("🟢 伺服器根目錄正常");
});

app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
  console.log(`📝 Render 啟動的 Port 是：${PORT}`);
});

