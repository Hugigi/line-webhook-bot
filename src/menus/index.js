// File: menus/index.js

// 載入各家原始菜單（請確保檔案名稱與路徑大小寫完全吻合）
const rawYiBo   = require('./rawYiBo');       // already flat :contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}
const rawACheng = require('./rawACheng');    // nested, needs flatten :contentReference[oaicite:6]{index=6}:contentReference[oaicite:7]{index=7}
const rawWeiDao = require('./rawWeiDao');    // nested, needs flatten :contentReference[oaicite:8]{index=8}:contentReference[oaicite:9]{index=9}
const rawChang  = require('./rawChang');     // already flat :contentReference[oaicite:10]{index=10}:contentReference[oaicite:11]{index=11}
const flatten   = require('./flatten');      // only for nested raws :contentReference[oaicite:12]{index=12}:contentReference[oaicite:13]{index=13}


// 匯出所有商家的扁平化菜單
module.exports = {
  '益伯':     rawYiBo,
  '阿城':     flatten(rawACheng),
  '味道食堂': flatten(rawWeiDao),
  '嚐鮮':     rawChang,
};
