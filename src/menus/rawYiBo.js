// src/menus/yiBo.js
/**
 * 益伯菜單整合並平坦化：
 * 1. 肉圓（大/小）
 * 2. 鍋燒系列（無大小）：<口味>鍋燒<麵種>
 * 3. 粥品
 * 4. 湯品及其他單品
 */

const raw = {
  // 1. 肉圓分大/小
  meatball: { large: 100, small: 50 },

  // 2. 鍋燒系列：口味對應價格
  hotpot: {
    '鍋燒': 75,
    '沙茶': 85,
    '泡菜': 85,
    '菇菇': 90,
    '奶香': 95,
    '咖哩': 95,
    '南瓜': 95,
    '麻辣': 110,
    '椰香': 115
  },

  // 2b. 麵種列表
  noodles: ['意麵', '雞絲麵', '烏龍', '泡飯', '冬粉', '科學麵'],

  // 3 & 4. 粥品與湯品等其他單品
  others: {
    '芙蓉玉米粥': 70,
    '皮蛋瘦肉粥': 75,
    '吻仔魚粥': 75,
    '牛肉粥': 85,
    '紫菜吻仔魚粥': 85,
    '皮蛋玉米粥': 90,
    '皮蛋牛肉粥': 90,
    '綜合湯': 30,
    '貢丸湯': 25,
    '菜頭湯': 25,
    '魚丸湯': 25,
    '紫菜蛋花湯': 25,
    '蛤蜊紫菜湯': 30,
    '鮮菇紫菜湯': 25,
    '紫菜魚丸湯': 25,
    '燙青菜': 40,
    '煙燻豬耳': 30,
    '金絲幼筍': 30,
    '皮蛋豆腐': 35,
    '涼拌海帶絲': 30,
    '魚卵沙拉': 40,
    '蜜汁海帶': 40
  }
};

// 平坦化最終菜單
const menus = {};

// 1. 肉圓大小
menus['肉圓大'] = raw.meatball.large;
menus['大肉圓'] = raw.meatball.large;
menus['肉圓小'] = raw.meatball.small;
menus['小肉圓'] = raw.meatball.small;

// 2. 鍋燒系列：湯底價格 + 麵種
raw.noodles.forEach(noodle => {
  Object.entries(raw.hotpot).forEach(([flavor, price]) => {
    const key = flavor === '鍋燒'
      ? `鍋燒${noodle}`
      : `${flavor}鍋燒${noodle}`;
    menus[key] = price;
  });
});

// 3 & 4. 粥品及其他單品
Object.entries(raw.others).forEach(([item, price]) => {
  menus[item] = price;
});

module.exports = menus;