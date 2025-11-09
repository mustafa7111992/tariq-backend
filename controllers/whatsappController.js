// controllers/whatsappController.js
const OtpCode = require("../models/OtpCode");
const { sendWhatsapp } = require("../utils/sendWhatsapp");
const Customer = require("../models/Customer");
const Provider = require("../models/Provider");

// توحيد الرقم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, "");

  // 07 عراقي
  if (p.startsWith("07")) {
    return `+964${p.slice(1)}`;
  }

  // دولي +
  if (p.startsWith("+")) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }

  // أرقام بس
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// يساعدنا نجيب الشخص حسب الدور
async function findUserByRole(role, phone) {
  if (role === "customer") {
    return Customer.findOne({ phone });
  }
  if (role === "provider") {
    return Provider.findOne({ phone });
  }
  return null;
}

// POST /api/whatsapp/send-code
// body: { phone, role: 'customer' | 'provider' }
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone, role } = req.body;

    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone is required" });
    }
    if (!role || !["customer", "provider"].includes(role)) {
      return res.status(400).json({ ok: false, error: "valid role is required" });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid phone number format" });
    }

    // 1) نتأكد مسجل أصلًا حسب الدور
    const existingUser = await findUserByRole(role, normalized);
    if (!existingUser) {
      return res.status(404).json({
        ok: false,
        error:
          role === "customer"
            ? "customer not found, please register first"
            : "provider not found, please register first",
      });
    }

    // 2) rate limit على نفس الرقم
    const existingOtp = await OtpCode.findOne({ phone: normalized });
    if (existingOtp) {
      const diff = Date.now() - existingOtp.updatedAt.getTime();
      if (diff < 60_000) {
        // أقل من دقيقة
        return res.status(429).json({
          ok: false,
          error: "please wait before requesting new code",
          waitTime: Math.ceil((60_000 - diff) / 1000),
        });
      }
    }

    // 3) نولد كود
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقايق

    // 4) نخزنه
    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      {
        phone: normalized,
        code,
        expiresAt,
        role, // مهم
        attempts: 0,
      },
      { upsert: true, new: true }
    );

    // 5) نرسل واتساب
    await sendWhatsapp({ to: normalized, code });

    console.log(
      `OTP sent to ${normalized} for role=${role}`
    );

    return res.json({ ok: true, message: "code sent via whatsapp" });
  } catch (err) {
    console.error("sendLoginCode error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};

// POST /api/whatsapp/verify-code
// body: { phone, code }
exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: "phone and code are required" });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid phone number format" });
    }

    const record = await OtpCode.findOne({ phone: normalized });
    if (!record) {
      return res
        .status(400)
        .json({ ok: false, error: "code not found, request new one" });
    }

    // منخلي التطبيق يبعث role لأنّا حافظينه هنانا
    const role = record.role || "customer";

    // انتهى؟
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ phone: normalized });
      return res
        .status(400)
        .json({ ok: false, error: "code expired, request new one" });
    }

    // محاولات
    if (record.attempts >= 3) {
      await OtpCode.deleteOne({ phone: normalized });
      return res
        .status(429)
        .json({ ok: false, error: "too many attempts, request new code" });
    }

    // الكود غلط؟
    if (record.code !== code.trim()) {
      await OtpCode.findOneAndUpdate(
        { phone: normalized },
        { $inc: { attempts: 1 } }
      );
      return res
        .status(400)
        .json({ ok: false, error: "invalid code" });
    }

    // الكود صح ✅
    // نتأكد بعده موجود بهذا الدور
    const user = await findUserByRole(role, normalized);
    if (!user) {
      // حالة نادرة: انحذف بين الإرسال والتحقق
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(404).json({
        ok: false,
        error:
          role === "customer"
            ? "customer not found, please register first"
            : "provider not found, please register first",
      });
    }

    // نحذف الكود
    await OtpCode.deleteOne({ phone: normalized });

    console.log(
      `OTP verified for ${normalized} as ${role}`
    );

    return res.json({
      ok: true,
      message: "verified",
      user: {
        id: user._id,
        phone: user.phone,
        role,
        name: user.name || null,
      },
    });
  } catch (err) {
    console.error("verifyCode error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};