// parsers/yiBoParser.js

// 載入原始 rawYiBo 資料
const raw = require('../src/menus/rawYiBo');

module.exports = {
  /**
   * 解析一個益伯鍋燒點餐字串，回傳正規化後的 { itemName, price }，
   * 如果抓不到湯底或主食，則 price = null
   * @param {string} text  
   * @returns {{ itemName: string, price: number|null }}
   */
  parse(text) {
    // 先偵測加麵
    const addNoodle = /加麵|\+麵/.test(text);

    // 偵測「湯底」和「主食」
    const bases  = Object.keys(rawYiBo.hotpot);
    const foods  = Object.keys(rawYiBo.noodles);
    const soup   = bases.find(b => text.includes(b));
    const noodle = foods.find(n => text.includes(n));

    if (!soup || !noodle) {
      // Fallback：若沒同時找到，就讓上層模糊比對或單品查價
      return { itemName: text, price: null };
    }

    // 計算基本價
    let price = rawYiBo.hotpot[soup].large + rawYiBo.noodles[noodle].large;
    let name  = `${soup}${noodle}`;

    // 加麵 +15
    if (addNoodle) {
      price += 15;
      name   += '（加麵）';
    }

    return { itemName: name, price };
  }
};
