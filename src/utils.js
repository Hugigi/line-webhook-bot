/**
 * src/utils.js
 * 共用工具函式（含詳細 postToSheet Debug log）
 */

const line = require('@line/bot-sdk');
const fetch = require('node-fetch');
const path = require('path');

/** reply、postToSheet、fetchOrders 如前略 **/

function loadMenu(menuPath) {
  // 支援絕對或相對路徑，解析至 src/menus 目錄
  let fullPath;
  if (path.isAbsolute(menuPath)) {
    fullPath = menuPath;
  } else {
    // 移除可有可無的開頭 './' 或 'src/'
    const rel = menuPath.replace(/^(?:\.\/)?(?:src[\/])?/, '');
    // 從當前 utils.js 所在的 src 目錄上升一層，再接 rel
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
