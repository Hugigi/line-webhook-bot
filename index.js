// index.js

const express           = require('express');
const line              = require('@line/bot-sdk');
const fetch             = require('node-fetch');
const stringSimilarity  = require('string-similarity');
const yiBoParser        = require('./parsers/yiBoParser');
const menus             = require('./menus');

// 填入你的 LINE Channel 憑證
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'UVcUKRwKitjVT8qrGyPgCOkDDDBsqHk4jE1tmyyYVZKN2eJuVTJKDgOV/2qt3WXAOlQXp2uePgvyowbaSV2CLO8kEYF8RxkOKstPUUMHNJIEHnS1B27Hf5kIjk+xlYvau5qZBSzITrPj9XSfOy433QdB04t89/1O/w1cDnyilFU=',
  channelSecret:      process.env.LINE_CHANNEL_SECRET       || 'b5e3a1ce94904cf6004630cd5771d9b6',
};

const app    = express();
const client = new line.Client(config);

let todayVendor  = null;
let orderRecords = [];  // { student, vendor, items, total, date }

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.post(
  '/webhook',
  line.middleware(config),
  async (req, res) => {
    try {
      const results = await Promise.all(req.body.events.map(handleEvent));
      res.status(200).json(results.filter(r => r !== null));
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  }
);

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }
  const msg = event.message.text.trim();

  // ==== 0. 本月預收指令 ====
  // m1 會抓「預收金額：<任何字串>300」或「預收金額：<任何字串> 300」
  const m1 = msg.match(/^預收金額[:：]\s*(.+?)\s*(\d+)$/);
  // m2 保留「學生A本月預收300／：300」
  const m2 = msg.match(/^(.+?)本月預收[:：]?\s*(\d+)$/);
  if (m1 || m2) {
    const student = (m1 ? m1[1] : m2[1]).trim();
    const amount  = (m1 ? m1[2] : m2[2]).trim();
    const SCRIPT_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwp7P8JjnKbh1GDqQ1OQ-lp1WZVQjuC8kTUl2-rIEo9OMCe4K1mnUD_Tay0gKAYwWy0lA/exec';
    try {
      const resp = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student, amount }),
      });
      const body = await resp.json();
      if (body.status === 'ok') {
        return reply(event, `✅ ${student} 的本月預收已設定 $${amount}`);
      }
    } catch (e) {
      console.error('預收寫入失敗', e);
    }
    return reply(event,
      '⚠️ 設定本月預收失敗，請確認格式「預收金額：學生A 300」或「學生A本月預收 300」'
    );
  }

  // ==== 0.5 本月餐費 / 本月餘額 查詢 ====
  if (msg === '本月餐費' || msg === '本月餘額') {
    const action = msg === '本月餐費' ? 'expense' : 'balance';
    const SCRIPT_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwp7P8JjnKbh1GDqQ1OQ-lp1WZVQjuC8kTUl2-rIEo9OMCe4K1mnUD_Tay0gKAYwWy0lA/exec';
    try {
      const resp = await fetch(`${SCRIPT_URL}?action=${action}`);
      const list = await resp.json();  // [{ student, value }, ...]
      if (!Array.isArray(list) || !list.length) {
        return reply(event, '目前「善化彙整」沒有任何資料。');
      }
      const header = msg === '本月餐費'
        ? '📊 本月餐費列表'
        : '📈 本月餘額列表';
      const lines = list.map(item => `${item.student}：$${item.value}`);
      return reply(event, `${header}\n${lines.join('\n')}`);
    } catch (e) {
      console.error('查詢本月列表失敗', e);
      return reply(event, '⚠️ 無法取得本月資料，請稍後再試。');
    }
  }

  // ==== 1. 設定今日商家 ====
  const vMatch = msg.match(/^今日商家[:：]\s*(.+)$/);
  if (vMatch) {
    const v = vMatch[1].trim();
    if (menus[v]) {
      todayVendor  = v;
      orderRecords = [];
      return reply(event, `✅ 今日商家已設定為「${v}」`);
    }
    return reply(event, `⚠️ 找不到商家「${v}」`);
  }

  // ==== 2. 顯示菜單 ====
  const showMatch = msg.match(/^(.+?)的?菜單$/);
  if (showMatch) {
    const name = showMatch[1].trim();
    if (!menus[name]) {
      return reply(event, `⚠️ 找不到商家「${name}」`);
    }
    const lines = Object.entries(menus[name])
      .map(([n, p]) => `${n}：$${p}`)
      .join('\n');
    return reply(event, `「${name}」菜單：\n${lines}`);
  }

  // ==== 3. 取消訂單 ====
  const cancelMatch = msg.match(/^取消訂單[:：]\s*(.+)$/);
  if (cancelMatch) {
    const student = cancelMatch[1].trim();
    const before  = orderRecords.length;
    orderRecords = orderRecords.filter(o => o.student !== student);
    return reply(event,
      before === orderRecords.length
        ? `⚠️ 找不到「${student}」的訂單`
        : `✅ 已取消「${student}」的訂單`
    );
  }

  // ==== 4. 修改訂單 ====
  const modMatch = msg.match(/^修改訂單[:：]\s*(.+?)[:：]\s*(.+)$/);
  if (modMatch) {
    const student = modMatch[1].trim();
    orderRecords = orderRecords.filter(o => o.student !== student);
    return processOrderLine(event, `${student}：${modMatch[2]}`);
  }

  // ==== 5. 下訂單 (支援多行) ====
  const linesArr   = msg.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const orderLines = linesArr.filter(l => /^(.+?)[:：]\s*(.+)$/.test(l));
  if (!orderLines.length) return null;

  const replies = [];
  for (const line of orderLines) {
    replies.push(await processOrderLine(event, line));
  }
  return reply(event, replies.join('\n'));
}

async function processOrderLine(event, line) {
  const [, student, rest] = line.match(/^(.+?)[:：]\s*(.+)$/);

  // 忽略不影響價格的註解
  const cleaned = rest.replace(/(?:不?加|不要)[^＋+、,]+/g, '').trim();
  const parts  = cleaned.split(/[＋+、,]/).map(p => p.trim()).filter(p => p);

  let total    = 0;
  const details = [];
  const missing = [];

  for (let raw of parts) {
    let vendor  = todayVendor;
    let itemKey = raw;
    const vm = raw.match(/^(.+?)[-–](.+)$/);
    if (vm && menus[vm[1].trim()]) {
      vendor  = vm[1].trim();
      itemKey = vm[2].trim();
    }

    // 數量偵測
    let qty = 1;
    const qm = itemKey.match(/(.+?)\s*[xX*]\s*(\d+)$/);
    if (qm) {
      itemKey = qm[1].trim();
      qty     = parseInt(qm[2], 10);
    }

    // 大/小偵測
    let nameKey = itemKey;
    const sm = nameKey.match(/^(.+?)[（(](大|小)[）)]$/)
            || nameKey.match(/^(.+?)(大|小)$/)
            || nameKey.match(/^([大小])(.+)$/);
    if (sm) {
      const core = sm.length === 3 ? sm[1] : sm[2];
      const size = sm.length === 3 ? sm[2] : sm[1];
      nameKey = `${size}${core}`;
    }

    const menu = menus[vendor] || {};
    let price = null;
    let itemName = nameKey;

    // 益伯專屬解析
    if (vendor === '益伯') {
      const r = yiBoParser.parse(itemKey);
      if (r.price != null) {
        itemName = r.itemName;
        price    = r.price;
      }
    }

    // 扁平化查價
    if (price == null) price = menu[itemName];

    // 模糊比對
    const keys = Object.keys(menu);
    if (price == null && keys.length) {
      const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(itemName, keys);
      if (bestMatch.rating > 0.6) {
        itemName = keys[bestMatchIndex];
        price    = menu[itemName];
      }
    }

    if (price == null) {
      missing.push(raw);
      continue;
    }

    total += price * qty;
    details.push(`${itemName} x${qty}($${price * qty})`);
    orderRecords.push({
      student,
      vendor,
      items: [{ name: itemName, qty, price }],
      total,
      date: new Date().toISOString(),
    });
  }

  if (missing.length) {
    return `⚠️ ${student}：找不到 ${missing.join('、')}`;
  }
  return `✅ ${student}：${details.join(' + ')}，共 $${total}`;
}

function reply(event, text) {
  return client.replyMessage(event.replyToken, { type: 'text', text });
}

app.get('/orders', (req, res) => {
  res.json(orderRecords);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Bot 啟動，Listening on port ${port}`);
});
