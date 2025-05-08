// File: menus/flatten.js
/**
 * 將 raw 資料物件展平成單層 key–value 結構
 * @param {Object} raw 原始菜單資料，形如：
 *   { congee: {...}, soups: {...}, hotpot: {...}, rice: {...}, sides: {...}, drinks: {...}, addOns: {...} }
 * @returns {Object} flat 扁平化後的菜單物件
 */
function flatten(raw) {
  const flat = {};

  // 針對 raw 的每一個子分類（不再依賴固定名稱）
  Object.values(raw).forEach(items => {
    Object.entries(items).forEach(([name, val]) => {
      // 若 val 是 { large, small } 形式，就展開成大／小兩種選項
      if (
        val &&
        typeof val === 'object' &&
        val.large !== undefined &&
        val.small !== undefined
      ) {
        flat[`大${name}`] = val.large;
        flat[`小${name}`] = val.small;
      } else {
        flat[name] = val;
      }
    });
  });

  return flat;
}

module.exports = flatten;
