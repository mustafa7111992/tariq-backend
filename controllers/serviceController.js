// controllers/serviceController.js
const { ok } = require("../utils/helpers");
const { getCache, setCache } = require("../utils/cache");

exports.getServices = async (req, res) => {
  const cacheKey = "services:all";
  const cached = getCache(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return ok(res, cached);
  }

  const services = [
    { code: "fuel", name: "تزويد وقود", category: "طوارئ", icon: "⛽️", basePrice: 15000 },
    { code: "tow", name: "سطحة / سحب", category: "طوارئ", icon: "🛻", basePrice: 50000 },
    { code: "tire", name: "بنچر", category: "طوارئ", icon: "🛞", basePrice: 20000 },
    { code: "battery", name: "تشغيل بطارية", category: "طوارئ", icon: "🔋", basePrice: 25000 },
    { code: "mechanic", name: "ميكانيكي متنقل", category: "صيانة", icon: "🧰", basePrice: 30000 },
    { code: "oil", name: "تغيير زيت", category: "صيانة", icon: "🛢️", basePrice: 40000 },
    { code: "wash", name: "غسيل سيارات", category: "صيانة", icon: "🚿", basePrice: 15000 },
    { code: "keys", name: "فتح سيارة", category: "أخرى", icon: "🔑", basePrice: 35000 },
  ];

  const data = { services, updatedAt: new Date().toISOString() };
  setCache(cacheKey, data);
  res.setHeader("X-Cache", "MISS");
  ok(res, data);
};