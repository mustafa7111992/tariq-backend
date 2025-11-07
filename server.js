// server.js (نسخة مطوّرة)

// 1) env
require("dotenv").config();

// 2) imports
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();

// 3) middlewares الأساسية
app.use(cors()); // تقدر تخصصه للدوومين مالك
app.use(express.json({ limit: "1mb" }));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
// تحديد عدد الريكوست حتى ما أحد يـDOS السيرفر
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
  })
);

// 4) اتصال Mongo
const mongoUri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tariqdb";

mongoose
  .connect(mongoUri, { dbName: "tariqdb" })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 5) ============== الموديلات ==============

// users
const userSchema = new mongoose.Schema(
  {
    name: String,
    phone: { type: String, required: true, unique: true },
    role: { type: String, default: "customer" }, // customer | provider | admin
    serviceType: String, // نوع الخدمة للمزوّد
    city: String,
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// service requests
const requestSchema = new mongoose.Schema(
  {
    serviceType: { type: String, required: true },
    notes: String,
    city: { type: String, default: null },
    location: {
      lat: Number,
      lng: Number,
    },
    // pending | accepted | on-the-way | in-progress | done | cancelled
    status: { type: String, default: "pending" },

    // من استلمه؟
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptedByPhone: { type: String, default: null },

    // من طلب؟
    customerPhone: { type: String, default: null },

    // ⭐ تقييم الزبون للمزوّد
    providerRating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date,
    },

    // ⭐ تقييم المزوّد للزبون
    customerRating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date,
    },
  },
  { timestamps: true }
);
const ServiceRequest = mongoose.model("ServiceRequest", requestSchema);

// إعدادات المزود
const providerSettingsSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    notificationsEnabled: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    maxDistance: { type: Number, default: 30 },
    isOnline: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const ProviderSettings = mongoose.model(
  "ProviderSettings",
  providerSettingsSchema
);

// 6) دوال مساعدة
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ok(res, data = {}, meta = {}) {
  return res.json({ ok: true, data, meta });
}
function fail(res, msg = "internal error", code = 500) {
  return res.status(code).json({ ok: false, error: msg });
}

// 7) مسار تجريبي
app.get("/", (_req, res) => {
  ok(res, { message: "Tariq backend is running ✅" });
});

// 8) الخدمات الثابتة
app.get("/api/services", (_req, res) => {
  const services = [
    { code: "fuel", name: "تزويد وقود", category: "طوارئ", icon: "⛽️" },
    { code: "tow", name: "سطحة / سحب", category: "طوارئ", icon: "🛻" },
    { code: "tire", name: "بنچر", category: "طوارئ", icon: "🛞" },
    { code: "battery", name: "تشغيل بطارية", category: "طوارئ", icon: "🔋" },

    { code: "mechanic", name: "ميكانيكي متنقل", category: "صيانة", icon: "🧰" },
    { code: "oil", name: "تغيير زيت", category: "صيانة", icon: "🛢️" },
    { code: "wash", name: "غسيل سيارات", category: "صيانة", icon: "🚿" },

    { code: "keys", name: "فتح سيارة", category: "أخرى", icon: "🔑" },
  ];
  ok(res, { services, updatedAt: new Date().toISOString() });
});

// ============== USERS ==============
app.post("/api/users", async (req, res) => {
  try {
    const { name, phone, role, serviceType, city } = req.body;
    if (!phone) return fail(res, "phone is required", 400);

    let user = await User.findOne({ phone });
    if (user) return ok(res, user);

    user = await User.create({
      name: name || "",
      phone,
      role: role || "customer",
      serviceType: serviceType || null,
      city: city || null,
    });

    return ok(res, user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    return fail(res);
  }
});

app.get("/api/users", async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  ok(res, users);
});

// ============== REQUESTS ==============

// إنشاء طلب
app.post("/api/requests", async (req, res) => {
  try {
    const { serviceType, notes, location, city, customerPhone } = req.body;
    if (!serviceType) return fail(res, "serviceType is required", 400);

    const doc = await ServiceRequest.create({
      serviceType,
      notes: notes || "",
      location: location || null,
      city: city || null,
      customerPhone: customerPhone || null,
    });

    return ok(res, doc);
  } catch (err) {
    console.error("POST /api/requests error:", err);
    return fail(res);
  }
});

// كل الطلبات
app.get("/api/requests", async (_req, res) => {
  const reqs = await ServiceRequest.find().sort({ createdAt: -1 });
  ok(res, reqs);
});

// طلبات زبون معيّن
app.get("/api/requests/by-phone", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400);

    const reqs = await ServiceRequest.find({ customerPhone: phone }).sort({
      createdAt: -1,
    });
    return ok(res, reqs);
  } catch (err) {
    console.error("GET /api/requests/by-phone error:", err);
    return fail(res);
  }
});

// إلغاء من الزبون
app.post("/api/requests/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.status = "cancelled";
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("POST /api/requests/:id/cancel error:", err);
    return fail(res);
  }
});

// ✅ الطلبات القريبة للمزوّد
app.get("/api/requests/for-provider", async (req, res) => {
  try {
    const { lat, lng, serviceType, phone, maxKm = 30 } = req.query;
    if (!lat || !lng) return fail(res, "lat and lng are required", 400);

    // لو عنده طلب شغال رجع بس هذا
    if (phone) {
      const activeReq = await ServiceRequest.findOne({
        acceptedByPhone: phone,
        status: { $in: ["accepted", "on-the-way", "in-progress"] },
      }).sort({ createdAt: -1 });

      if (activeReq) return ok(res, [activeReq]);
    }

    let maxDistance = parseFloat(maxKm);
    if (phone) {
      const settings = await ProviderSettings.findOne({ phone });
      if (settings?.maxDistance) maxDistance = settings.maxDistance;
    }

    const query = {};
    if (serviceType) query.serviceType = serviceType;

    const allRequests = await ServiceRequest.find(query).sort({
      createdAt: -1,
    });

    const providerLat = parseFloat(lat);
    const providerLng = parseFloat(lng);

    const nearby = allRequests
      .map((reqDoc) => {
        // ما نعرض المنتهية
        if (["done", "cancelled"].includes(reqDoc.status)) return null;

        // لو مقبولة من غيره خَلّها
        if (
          reqDoc.status !== "pending" &&
          reqDoc.acceptedByPhone &&
          phone &&
          reqDoc.acceptedByPhone !== phone
        ) {
          return null;
        }

        if (!reqDoc.location?.lat || !reqDoc.location?.lng) return null;

        const d = getDistanceKm(
          providerLat,
          providerLng,
          reqDoc.location.lat,
          reqDoc.location.lng
        );
        if (d <= maxDistance) {
          return { ...reqDoc.toObject(), distance: d };
        }
        return null;
      })
      .filter(Boolean);

    return ok(res, nearby);
  } catch (err) {
    console.error("GET /api/requests/for-provider error:", err);
    return fail(res);
  }
});

// ✅ قبول الطلب
app.patch("/api/requests/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;
    if (!providerPhone) return fail(res, "providerPhone is required", 400);

    // يمنع المزود يكون عنده أكثر من طلب شغال
    const activeForThisProvider = await ServiceRequest.findOne({
      acceptedByPhone: providerPhone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    });
    if (activeForThisProvider) {
      return fail(
        res,
        "you already have active request, finish it first",
        400
      );
    }

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    // لو شخص ثاني سبقك
    if (
      reqDoc.status !== "pending" &&
      reqDoc.acceptedByPhone &&
      reqDoc.acceptedByPhone !== providerPhone
    ) {
      return fail(res, "request already accepted by another provider", 409);
    }

    reqDoc.status = "accepted";
    reqDoc.acceptedByPhone = providerPhone;
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/accept error:", err);
    return fail(res);
  }
});

// ✅ في الطريق
app.patch("/api/requests/:id/on-the-way", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.status = "on-the-way";
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/on-the-way error:", err);
    return fail(res);
  }
});

// ✅ قيد التنفيذ
app.patch("/api/requests/:id/in-progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.status = "in-progress";
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/in-progress error:", err);
    return fail(res);
  }
});

// ✅ إنهاء الطلب
app.patch("/api/requests/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.status = "done";
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/complete error:", err);
    return fail(res);
  }
});

// ✅ إلغاء الطلب من المزوّد
app.patch("/api/requests/:id/cancel-by-provider", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.status = "cancelled";
    reqDoc.acceptedByPhone = null;
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/cancel-by-provider error:", err);
    return fail(res);
  }
});

// ============== PROVIDER SETTINGS ==============
app.get("/api/provider/settings", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400);

    const doc = await ProviderSettings.findOne({ phone });
    if (!doc) {
      return ok(res, {
        phone,
        notificationsEnabled: true,
        soundEnabled: true,
        maxDistance: 30,
        isOnline: true,
      });
    }
    return ok(res, doc);
  } catch (err) {
    console.error("GET /api/provider/settings error:", err);
    return fail(res);
  }
});

app.post("/api/provider/settings", async (req, res) => {
  try {
    const {
      phone,
      notificationsEnabled,
      soundEnabled,
      maxDistance,
      isOnline,
    } = req.body;
    if (!phone) return fail(res, "phone is required", 400);

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      {
        notificationsEnabled:
          typeof notificationsEnabled === "boolean"
            ? notificationsEnabled
            : true,
        soundEnabled: typeof soundEnabled === "boolean" ? soundEnabled : true,
        maxDistance: maxDistance ?? 30,
        isOnline: typeof isOnline === "boolean" ? isOnline : true,
      },
      { upsert: true, new: true }
    );

    return ok(res, doc);
  } catch (err) {
    console.error("POST /api/provider/settings error:", err);
    return fail(res);
  }
});

app.post("/api/provider/status", async (req, res) => {
  try {
    const { phone, status } = req.body;
    if (!phone) return fail(res, "phone is required", 400);
    if (!status) return fail(res, "status is required", 400);

    const isOnline = status === "online";
    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      { isOnline },
      { upsert: true, new: true }
    );
    return ok(res, doc);
  } catch (err) {
    console.error("POST /api/provider/status error:", err);
    return fail(res);
  }
});

// ============== التقييم ==============

// الزبون يقيّم المزوّد
app.post("/api/requests/:id/rate-provider", async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body; // phone = customerPhone
    if (!score) return fail(res, "score is required", 400);

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    // نتأكد هذا فعلاً زبونه
    if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.providerRating = {
      score,
      comment: comment || "",
      ratedAt: new Date(),
    };
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("POST /api/requests/:id/rate-provider error:", err);
    return fail(res);
  }
});

// المزوّد يقيّم الزبون
app.post("/api/requests/:id/rate-customer", async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body; // phone = providerPhone
    if (!score) return fail(res, "score is required", 400);

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, "request not found", 404);

    // نتأكد هذا المزود اللي نفّذ
    if (phone && reqDoc.acceptedByPhone && phone !== reqDoc.acceptedByPhone) {
      return fail(res, "not your request", 403);
    }

    reqDoc.customerRating = {
      score,
      comment: comment || "",
      ratedAt: new Date(),
    };
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error("POST /api/requests/:id/rate-customer error:", err);
    return fail(res);
  }
});

// إحصائيات مزوّد
app.get("/api/provider/stats", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400);

    const total = await ServiceRequest.countDocuments({
      acceptedByPhone: phone,
    });
    const done = await ServiceRequest.countDocuments({
      acceptedByPhone: phone,
      status: "done",
    });
    const active = await ServiceRequest.countDocuments({
      acceptedByPhone: phone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    });

    // متوسط التقييم
    const rated = await ServiceRequest.find({
      acceptedByPhone: phone,
      "providerRating.score": { $exists: true },
    }).select("providerRating.score");

    let avgRating = null;
    if (rated.length > 0) {
      avgRating =
        rated.reduce((sum, r) => sum + r.providerRating.score, 0) /
        rated.length;
      avgRating = Math.round(avgRating * 10) / 10;
    }

    return ok(res, {
      phone,
      total,
      done,
      active,
      avgRating,
    });
  } catch (err) {
    console.error("GET /api/provider/stats error:", err);
    return fail(res);
  }
});

// إحصائيات عامة للتطبيق
app.get("/api/admin/overview", async (_req, res) => {
  const users = await User.countDocuments();
  const requests = await ServiceRequest.countDocuments();
  const done = await ServiceRequest.countDocuments({ status: "done" });
  ok(res, { users, requests, done });
});

// 404
app.use((_req, res) => {
  return res.status(404).json({ ok: false, error: "Not found" });
});

// error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  return res.status(500).json({ ok: false, error: "server error" });
});

//  ============== تشغيل السيرفر ==============
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("🚀 Server listening on port " + PORT);
});