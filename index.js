require('dotenv').config({ path: `.env.${process.env.TENANT_ID}` });
const express = require('express');
const app     = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('📨 收到 LINE Webhook：', JSON.stringify(req.body, null, 2));
  return res.status(200).end();
});

app.get('/ping', (req, res) => {
  console.log('🏓 /ping 被呼叫');
  return res.status(200).send('pong');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Bot 啟動，Listening on port ${PORT}`);
});
