// index.js
require('dotenv').config({ path: `.env.${process.env.TENANT_ID}` });

const express = require('express');
const line    = require('@line/bot-sdk');
const path    = require('path');

// 1️⃣ 載入租戶設定
const tenantId = process.env.TENANT_ID;
if (!tenantId) {
  console.error('❌ 請先設定 TENANT_ID 環境變數');
  process.exit(1);
}
let config;
try {
  config = require(path.join(__dirname,'config','tenants', tenantId + '.js'));
} catch (e) {
  console.error(`❌ 找不到租戶設定：config/tenants/${tenantId}.js`);
  process.exit(1);
}

// 2️⃣ 載入所有 features
const features = require('./src/features');
console.log('🔧 Features loaded:', features.map(f => f.name));

// 3️⃣ 啟動 Express + LINE
const app = express();
app.use(express.json());

app.post(
  '/webhook',
  line.middleware({
    channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret:      config.LINE_CHANNEL_SECRET
  }),
  async (req, res) => {
    try {
      console.log('📨 收到事件', JSON.stringify(req.body.events));
      for (const ev of req.body.events) {
        if (ev.type==='message' && ev.message.type==='text') {
          for (const feat of features) {
            try {
              const handled = await feat.handle(ev, config);
              if (handled) break;
            } catch(err) {
              console.error(`❌ Feature ${feat.name} 執行時錯誤：`, err);
            }
          }
        }
      }
      // 一定回 200
      return res.status(200).end();
    } catch (err) {
      console.error('⚠️ 未捕捉到的錯誤：', err);
      // 給 LINE 200，避免重試
      return res.status(200).end();
    }
  }
);

// 本地 debug: 看記憶體訂單
app.get('/orders', (req, res) => {
  res.json(config.orderRecords || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ${tenantId} Bot 啟動，Listening on port ${PORT}`);
});
