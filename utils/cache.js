// utils/cache.js
const cache = new Map();

function setCache(key, value, ttlMs) {
  cache.set(key, { value, expiry: Date.now() + (ttlMs || 5 * 60 * 1000) });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function clearCache(pattern) {
  if (!pattern) return cache.clear();
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

module.exports = { setCache, getCache, clearCache };