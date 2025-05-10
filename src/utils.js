// src/utils.js
// 共用工具函式（含詳細 postToSheet Debug log）

const line = require('@line/bot-sdk');
const fetch = require('node-fetch');
const path = require('path');

/**
 * reply：LINE 回覆文字訊息
 */
async function reply(event, text, config) {
  const client = new line.Client({
    channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN
  });
  const message = { type: 'text', text };
  return client.replyMessage(event.replyToken, message);
}

/**
 * postToSheet：將訂單資料傳至 Google Sheets WebApp
 */
async function postToSheet(webAppUrl, sheetName, payload) {
  // 增加調試日誌：請求前打印 URL 與 payload
  const url = `${webAppUrl}?sheet=${sheetName}`;
  console.log('[utils] postToSheet 請求 URL：', url);
  console.log('[utils] postToSheet 請求 Body：', JSON.stringify(payload));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[utils] postToSheet 錯誤回應：', res.status, text);
      throw new Error(`postToSheet 錯誤: ${res.status} ${text}`);
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    console.log('[utils] postToSheet 成功回應：', data);
    return data;
  } catch (e) {
    console.error('[utils] postToSheet 執行例外：', e);
    throw e;
  }
}

/**
 * fetchOrders：取得歷史訂單（預留功能）
 */
async function fetchOrders(webAppUrl) {
  const res = await fetch(webAppUrl);
  if (!res.ok) throw new Error(`fetchOrders 錯誤: ${res.status}`);
  return res.json();
}

/**
 * loadMenu：讀取菜單模組，並印出實際使用路徑
 * @param {string} menuPath — config 裡設定的路徑，支援絕對或相對
 */
function loadMenu(menuPath) {
  let fullPath;
  if (path.isAbsolute(menuPath)) {
    fullPath = menuPath;
  } else {
    // 移除前導 './' 或 'src/'，並以 __dirname 作為 base
    const rel = menuPath.replace(/^(?:\.\/)?(?:src[\/])?/, '');
    fullPath = path.resolve(__dirname, '..', rel);
  }
  console.log('[utils] loadMenu 使用路徑：', fullPath);
  return require(fullPath);
}

module.exports = {
  reply,
  postToSheet,
  fetchOrders,
  loadMenu
};
