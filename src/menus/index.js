// File: menus/index.js

// 載入各家原始菜單（請確保檔案名稱與路徑大小寫完全吻合）
const rawYiBo   = require('./rawYiBo');
const rawACheng = require('./rawACheng');
const rawWeiDao = require('./rawWeiDao');
const rawChang  = require('./rawChang');

// 扁平化函式
const flatten = require('./flatten');

// 匯出所有商家的扁平化菜單
module.exports = {
  '益伯':     flatten(rawYiBo),
  '阿城':     flatten(rawACheng),
  '味道食堂': flatten(rawWeiDao),
  '嚐鮮':     flatten(rawChang),
};
