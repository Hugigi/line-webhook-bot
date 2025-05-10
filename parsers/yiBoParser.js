// parsers/yiBoParser.js

// 1. 引入原始菜單資料
const rawYiBo = require('../src/menus/rawYiBo');

// 2. 你的现有解析逻辑…
module.exports = {
  parse(input) {
    // 假设 rawYiBo 是一个 name→price 的 object
    const item = rawYiBo[input];
    if (item != null) {
      return { itemName: input, price: item };
    }
    return { itemName: input, price: null };
  }
};
