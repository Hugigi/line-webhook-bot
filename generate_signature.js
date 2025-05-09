// generate_signature.js
const crypto = require('crypto');

// 🔎 設定你的 Channel Secret
const channelSecret = 'b5e3a1ce94904cf6004630cd5771d9b6'; // 請替換成你的 Secret

// 🔎 設定你要傳送的 body 資料
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
  .update(body)
  .digest('base64');

// 🔎 顯示結果
console.log("📝 生成的 X-Line-Signature 是：", signature);
