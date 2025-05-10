// src/utils.js
// 共用工具函式（含詳細 postToSheet Debug log）

const line = require('@line/bot-sdk');
const fetch = require('node-fetch');
const path = require('path');

/**
 * reply：LINE 回覆文字訊息
 * @param {Object} event  — LINE webhook event
 * @param {string} text   — 要回覆的文字
 * @param {Object} config — 租戶設定物件，需包含 LINE_CHANNEL_ACCESS_TOKEN / SECRET
 */
async function reply(event, text, config) {
  // ... (原回覆邏輯)
}

/**
 * postToSheet：將訂單資料傳至 Google Sheets WebApp
 */
async function postToSheet(webAppUrl, sheetName, payload) {
  // ... (原 postToSheet 邏輯)
}

/**
 * fetchOrders：取得歷史訂單（可選）
 */
async function fetchOrders() {
  // ... (如有此功能)
}

/**
 * loadMenu：讀取菜單模組，並印出實際使用路徑
 * @param {string} menuPath — config 裡設定的路徑，支援絕對或相對
 */
function loadMenu(menuPath) {
  // 支援絕對或相對路徑
  let fullPath;
  if (path.isAbsolute(menuPath)) {
    fullPath = menuPath;
  } else {
    // 移除可能的開頭 src/ 或 ./src/
    const rel = menuPath.replace(/^(?:\.\/)?src[\/]/, '');
    // 往上移一級至第二層 src 目錄
    fullPath = path.resolve(__dirname, '..', rel);
  }
  console.log('[utils] loadMenu 使用路徑：', fullPath);
  return require(fullPath);
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
