// utils/sendWhatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TWILIO_CONTENT_SID,
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, {
  timeout: 20000, // 20 ثانية
});

function normalizeToWhatsapp(phone) {
  if (!phone) return null;
  let p = phone.trim();
  if (p.startsWith('whatsapp:')) return p;
  if (p.startsWith('+')) return 'whatsapp:' + p;
  if (p.startsWith('07')) {
    p = '+964' + p.slice(1);
    return 'whatsapp:' + p;
  }
  return 'whatsapp:' + p;
}

// 🔄 دالة إرسال مع retry
async function sendWhatsappWithRetry({ to, code }, maxRetries = 2) {
  const toWhatsApp = normalizeToWhatsapp(to);
  if (!toWhatsApp) {
    throw new Error('invalid phone');
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Sending WhatsApp (attempt ${attempt}/${maxRetries}) to ${toWhatsApp}...`);

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

      const result = await client.messages.create(messageBody);

      console.log(`✅ WhatsApp sent successfully on attempt ${attempt}`, {
        sid: result.sid,
        status: result.status,
      });

      return result;

    } catch (error) {
      lastError = error;
      console.error(`⚠️ Attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
      });

      // إذا كان آخر محاولة، ارمي الخطأ
      if (attempt === maxRetries) {
        throw error;
      }

      // انتظر قبل إعادة المحاولة
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw lastError;
}

async function sendWhatsapp({ to, code }) {
  return sendWhatsappWithRetry({ to, code }, 2);
}

module.exports = { sendWhatsapp };