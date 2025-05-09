// generate_signature.js
const crypto = require('crypto');

// 🔎 設定你的 Channel Secret（確認是 Render 後台的環境變數一致）
const channelSecret = 'b5e3a1ce94904cf6004630cd5771d9b6';

// 🔎 設定你要傳送的 body 資料（格式要一模一樣）
const body = JSON.stringify({
  events: [
    {
      type: "message",
      message: {
        type: "text",
        text: "測試訊息"
      }
    }
  ]
});

// 🔎 生成簽名
const signature = crypto
  .createHmac('SHA256', channelSecret)
  .update(Buffer.from(body, 'utf8')) // 確認 UTF-8 編碼
  .digest('base64');

// 🔎 顯示結果
console.log("📝 生成的 X-Line-Signature 是：", signature);
console.log("📝 生成的 Body 是：", body);
