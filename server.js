// server.js

// 1) تحميل env
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// 2) اتصال MongoDB
// نحاول ناخذ من .env
// MONGO_URI=mongodb+srv://.......
const mongoUri =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tariqdb"; // لو ماكو env يشتغل لوكال

if (!process.env.MONGO_URI) {
  console.warn("⚠️ MONGO_URI not found in .env, using local mongodb.");
}

mongoose
  .connect(mongoUri, { dbName: "tariqdb" })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ============== الموديلات ==============

// users
const userSchema = new mongoose.Schema(
  {
    name: String,
    phone: { type: String, required: true, unique: true },
    role: { type: String, default: "customer" }, // customer | provider | admin
    serviceType: String,
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
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },
    acceptedByPhone: { type: String, default: null },
    customerPhone: { type: String, default: null },
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

// ============== دوال المسافة ==============
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

// ============== مسار تجريبي ==============
app.get("/", (req, res) => {
  res.json({ message: "Tariq backend is running ✅" });
});

// ============== الخدمات (جديدة) ==============
app.get("/api/services", (req, res) => {
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

  res.json({
    services,
    updatedAt: new Date().toISOString(),
  });
});

// ============== USERS ==============
app.post("/api/users", async (req, res) => {
  try {
    const { name, phone, role, serviceType, city } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });

    let user = await User.findOne({ phone });
    if (user) return res.json(user);

    user = await User.create({
      name: name || "",
      phone,
      role: role || "customer",
      serviceType: serviceType || null,
      city: city || null,
    });

    return res.json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.get("/api/users", async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

// ============== REQUESTS ==============

// إنشاء طلب
app.post("/api/requests", async (req, res) => {
  try {
    const { serviceType, notes, location, city, customerPhone } = req.body;
    if (!serviceType) {
      return res.status(400).json({ error: "serviceType is required" });
    }

    const doc = await ServiceRequest.create({
      serviceType,
      notes: notes || "",
      location: location || null,
      city: city || null,
      customerPhone: customerPhone || null,
    });

    return res.json(doc);
  } catch (err) {
    console.error("POST /api/requests error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// كل الطلبات
app.get("/api/requests", async (_req, res) => {
  const reqs = await ServiceRequest.find().sort({ createdAt: -1 });
  res.json(reqs);
});

// طلبات زبون معيّن
app.get("/api/requests/by-phone", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }
    const reqs = await ServiceRequest.find({ customerPhone: phone }).sort({
      createdAt: -1,
    });
    return res.json(reqs);
  } catch (err) {
    console.error("GET /api/requests/by-phone error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// إلغاء من الزبون
app.post("/api/requests/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "request not found" });

    if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
      return res.status(403).json({ error: "not your request" });
    }

    reqDoc.status = "cancelled";
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("POST /api/requests/:id/cancel error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// ✅ الطلبات القريبة للمزوّد
app.get("/api/requests/for-provider", async (req, res) => {
  try {
    const { lat, lng, serviceType, phone, maxKm = 30 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    // لو عنده طلب شغال، رجع بس هذا
    if (phone) {
      const activeReq = await ServiceRequest.findOne({
        acceptedByPhone: phone,
        status: { $in: ["accepted", "on-the-way", "in-progress"] },
      }).sort({ createdAt: -1 });

      if (activeReq) {
        return res.json([activeReq]);
      }
    }

    let maxDistance = parseFloat(maxKm);
    if (phone) {
      const settings = await ProviderSettings.findOne({ phone });
      if (settings?.maxDistance) {
        maxDistance = settings.maxDistance;
      }
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
        if (["done", "cancelled"].includes(reqDoc.status)) return null;

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

    return res.json(nearby);
  } catch (err) {
    console.error("GET /api/requests/for-provider error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// ✅ قبول الطلب
app.patch("/api/requests/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    if (!providerPhone) {
      return res.status(400).json({ error: "providerPhone is required" });
    }

    const activeForThisProvider = await ServiceRequest.findOne({
      acceptedByPhone: providerPhone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    });
    if (activeForThisProvider) {
      return res.status(400).json({
        error: "you already have active request, finish it first",
      });
    }

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) {
      return res.status(404).json({ error: "request not found" });
    }

    if (
      reqDoc.status !== "pending" &&
      reqDoc.acceptedByPhone &&
      reqDoc.acceptedByPhone !== providerPhone
    ) {
      return res.status(409).json({
        error: "request already accepted by another provider",
      });
    }

    reqDoc.status = "accepted";
    reqDoc.acceptedByPhone = providerPhone;
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/accept error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// ✅ في الطريق
app.patch("/api/requests/:id/on-the-way", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "request not found" });

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return res.status(403).json({ error: "not your request" });
    }

    reqDoc.status = "on-the-way";
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/on-the-way error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// ✅ قيد التنفيذ
app.patch("/api/requests/:id/in-progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "request not found" });

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return res.status(403).json({ error: "not your request" });
    }

    reqDoc.status = "in-progress";
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/in-progress error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// إنهاء الطلب
app.patch("/api/requests/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "request not found" });

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return res.status(403).json({ error: "not your request" });
    }

    reqDoc.status = "done";
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/complete error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// إلغاء الطلب من المزوّد
app.patch("/api/requests/:id/cancel-by-provider", async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "request not found" });

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return res.status(403).json({ error: "not your request" });
    }

    reqDoc.status = "cancelled";
    reqDoc.acceptedByPhone = null;
    await reqDoc.save();

    return res.json(reqDoc);
  } catch (err) {
    console.error("PATCH /api/requests/:id/cancel-by-provider error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// ============== PROVIDER SETTINGS ==============
app.get("/api/provider/settings", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const doc = await ProviderSettings.findOne({ phone });
    if (!doc) {
      return res.json({
        phone,
        notificationsEnabled: true,
        soundEnabled: true,
        maxDistance: 30,
        isOnline: true,
      });
    }
    return res.json(doc);
  } catch (err) {
    console.error("GET /api/provider/settings error:", err);
    return res.status(500).json({ error: "internal error" });
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
    if (!phone) return res.status(400).json({ error: "phone is required" });

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

    return res.json(doc);
  } catch (err) {
    console.error("POST /api/provider/settings error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

app.post("/api/provider/status", async (req, res) => {
  try {
    const { phone, status } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    if (!status) return res.status(400).json({ error: "status is required" });

    const isOnline = status === "online";
    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      { isOnline },
      { upsert: true, new: true }
    );
    return res.json(doc);
  } catch (err) {
    console.error("POST /api/provider/status error:", err);
    return res.status(500).json({ error: "internal error" });
  }
});

// هنا شلنا:
// app.use("/api/providers", providerRoutes);
// لأن ما عندك هالملف حالياً

// ============== تشغيل السيرفر ==============
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("🚀 Server listening on port " + PORT);
});