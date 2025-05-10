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
  // 若為絕對路徑則直接使用，否則以專案根目錄為基準解析
  const fullPath = path.isAbsolute(menuPath)
    ? menuPath
    : path.resolve(process.cwd(), menuPath);
  console.log('[utils] loadMenu 使用路徑：', fullPath);
  return require(fullPath);
}

module.exports = {
  reply,
  postToSheet,
  fetchOrders,
  loadMenu
};
