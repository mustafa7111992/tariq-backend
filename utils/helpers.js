// utils/helpers.js
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ok(res, data = {}, meta = {}) {
  return res.json({ ok: true, data, meta, timestamp: new Date().toISOString() });
}

function fail(res, msg = 'internal error', code = 500, req) {
  return res.status(code).json({
    ok: false,
    error: msg,
    timestamp: new Date().toISOString(),
    requestId: req?.id,
  });
}

module.exports = { deg2rad, getDistanceKm, ok, fail };