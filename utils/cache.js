// utils/cache.js
const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000;

function setCache(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, expiry: Date.now() + ttl });
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
  for (const k of cache.keys()) {
    if (k.includes(pattern)) cache.delete(k);
  }
}

module.exports = {
  cache,
  setCache,
  getCache,
  clearCache,
};