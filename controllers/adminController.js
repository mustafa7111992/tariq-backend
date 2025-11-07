// controllers/adminController.js
const User = require("../models/User");
const ServiceRequest = require("../models/ServiceRequest");
const ActivityLog = require("../models/ActivityLog");
const { ok, fail } = require("../utils/helpers");
const { getCache, setCache, clearCache } = require("../utils/cache");

exports.getOverview = async (req, res) => {
  const cacheKey = "admin:overview";
  const cached = getCache(cacheKey);
  if (cached) return ok(res, cached);

  const [users, requests, done, pending, providers, activeRequests] =
    await Promise.all([
      User.countDocuments({ isActive: true }),
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: "done" }),
      ServiceRequest.countDocuments({ status: "pending" }),
      User.countDocuments({ role: "provider", isActive: true }),
      ServiceRequest.countDocuments({
        status: { $in: ["accepted", "on-the-way", "in-progress"] },
      }),
    ]);

  const data = {
    users,
    requests,
    done,
    pending,
    providers,
    activeRequests,
    completionRate: requests > 0 ? Math.round((done / requests) * 100) : 0,
  };

  setCache(cacheKey, data, 60 * 1000);
  ok(res, data);
};

exports.getActivity = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  const { phone } = req.query;

  const filter = phone ? { userPhone: phone } : {};

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ActivityLog.countDocuments(filter),
  ]);

  ok(res, logs, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
};

exports.clearCache = async (req, res) => {
  const { key, pattern } = req.body;
  if (key) {
    clearCache(key);
  } else if (pattern) {
    clearCache(pattern);
  } else {
    clearCache();
  }

  ok(res, { message: "cache cleared" });
};