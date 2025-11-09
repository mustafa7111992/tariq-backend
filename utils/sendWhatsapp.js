// utils/sendWhatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TWILIO_CONTENT_SID,
} = process.env;

// ⏱️ timeout أطول لأن retry موجود
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, {
  timeout: 25000, // 25 ثانية (أطول من 20)
  lazyLoading: true, // تحسين performance
});

// ============================================================================
// تنسيق الرقم لـ WhatsApp
// ============================================================================
function normalizeToWhatsapp(phone) {
  if (!phone) return null;
  let p = phone.trim();
  
  // already formatted
  if (p.startsWith('whatsapp:')) return p;
  
  // international format
  if (p.startsWith('+')) return 'whatsapp:' + p;
  
  // Iraqi number 07...
  if (p.startsWith('07')) {
    p = '+964' + p.slice(1);
    return 'whatsapp:' + p;
  }
  
  // default: add whatsapp prefix
  return 'whatsapp:' + p;
}

// ============================================================================
// 🔄 إرسال مع Retry (داخلي فقط)
// ============================================================================
async function sendWhatsappWithRetry({ to, code }, maxRetries = 2) {
  const toWhatsApp = normalizeToWhatsapp(to);
  if (!toWhatsApp) {
    throw new Error('invalid phone number');
  }

  let lastError;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 [${new Date().toISOString()}] Sending WhatsApp (attempt ${attempt}/${maxRetries}) to ${toWhatsApp}...`);

      // تجهيز الرسالة
      const messageBody = TWILIO_CONTENT_SID
        ? {
            from: TWILIO_WHATSAPP_FROM,
            contentSid: TWILIO_CONTENT_SID,
            contentVariables: JSON.stringify({ '1': code }),
            to: toWhatsApp,
          }
        : {
            from: TWILIO_WHATSAPP_FROM,
            to: toWhatsApp,
            body: `رمز التحقق الخاص بك في تطبيق طريق هو: ${code}\n\nصالح لمدة 5 دقائق.`,
          };

      // إرسال عبر Twilio
      const result = await client.messages.create(messageBody);

      const duration = Date.now() - startTime;
      console.log(`✅ [${new Date().toISOString()}] WhatsApp sent successfully in ${duration}ms`, {
        sid: result.sid,
        status: result.status,
        attempt,
        to: toWhatsApp,
      });

      return result;

    } catch (error) {
      lastError = error;
      const duration = Date.now() - startTime;
      
      console.error(`⚠️ [${new Date().toISOString()}] Attempt ${attempt} failed after ${duration}ms:`, {
        message: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo,
      });

      // إذا كان آخر محاولة، ارمي الخطأ
      if (attempt >= maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed for ${toWhatsApp}`);
        throw error;
      }

      // انتظر قبل إعادة المحاولة (exponential backoff)
      const waitTime = attempt * 2000; // 2s, 4s, 6s...
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// ============================================================================
// 🚀 الدالة الرئيسية (مع async background support)
// ============================================================================
async function sendWhatsapp({ to, code }) {
  // استدعاء الـ retry function
  return sendWhatsappWithRetry({ to, code }, 2);
}

// ============================================================================
// 🌟 دالة إرسال في Background (بدون انتظار)
// ============================================================================
function sendWhatsappBackground({ to, code }) {
  // تشغيل في background بدون await
  setImmediate(() => {
    sendWhatsappWithRetry({ to, code }, 2)
      .then((result) => {
        console.log(`✅ Background WhatsApp sent to ${to}`, {
          sid: result.sid,
        });
      })
      .catch((error) => {
        console.error(`❌ Background WhatsApp failed for ${to}:`, {
          message: error.message,
          code: error.code,
        });
      });
  });
}

module.exports = { 
  sendWhatsapp,           // للاستخدام العادي (مع await)
  sendWhatsappBackground, // للاستخدام في background (بدون await)
};