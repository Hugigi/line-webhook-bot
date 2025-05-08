// src/utils.js

/**
 * 共用工具函式
 */

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
  const client = new line.Client({
    channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret:      config.LINE_CHANNEL_SECRET
  });
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text
  });
}

/**
 * postToSheet：向 Apps Script Web App POST 資料
 * @param {string} url     — Web App exec URL
 * @param {string} type    — action type ('order','cancel','prepaid'…)
 * @param {Object} payload — 要送出的資料內容
 * @returns {boolean}      — 成功回傳 true，否則 false
 */
async function postToSheet(url, type, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload })
    });
    return res.ok;
  } catch (e) {
    console.error('postToSheet 錯誤：', e);
    return false;
  }
}

/**
 * fetchOrders：讀取記憶體訂單列表（開發 / debug 用）
 * @param {string} url — 本地 /orders endpoint URL
 * @returns {Array}    — orderRecords 陣列
 */
async function fetchOrders(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error('fetchOrders 錯誤：', e);
    return [];
  }
}

/**
 * loadMenu：載入指定路徑的菜單 JSON
 * @param {string} menuPath — 相對於專案根目錄的 JSON 路徑
 * @returns {Object}        — 解析後的菜單物件
 */
function loadMenu(menuPath) {
  // 確保路徑正確
  const fullPath = path.isAbsolute(menuPath)
    ? menuPath
    : path.join(__dirname, '..', menuPath);
  return require(fullPath);
}

module.exports = {
  reply,
  postToSheet,
  fetchOrders,
  loadMenu
};
