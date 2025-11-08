// utils/sendWhatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TWILIO_CONTENT_SID,
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// دالة تضبط الرقم قبل الإرسال
function normalizeToWhatsapp(phone) {
  if (!phone) return null;

  let p = phone.trim();

  // لو هو already whatsapp:+...
  if (p.startsWith('whatsapp:')) {
    return p;
  }

  // لو هو دولي جاهز +...
  if (p.startsWith('+')) {
    return 'whatsapp:' + p;
  }

  // لو رقم عراقي 07...
  if (p.startsWith('07')) {
    // +964 ونشيل الصفر الأول
    p = '+964' + p.slice(1);
    return 'whatsapp:' + p;
  }

  // غيرها اعتبره دولي واكبسله whatsapp:
  return 'whatsapp:' + p;
}

async function sendWhatsapp({ to, code }) {
  const toWhatsApp = normalizeToWhatsapp(to);
  if (!toWhatsApp) {
    throw new Error('invalid phone');
  }

  // لو عندك template
  if (TWILIO_CONTENT_SID) {
    return client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      contentSid: TWILIO_CONTENT_SID,
      contentVariables: JSON.stringify({ '1': code }),
      to: toWhatsApp,
    });
  }

  // لو ما عندك template ابعث نص عادي
  return client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: toWhatsApp,
    body: `رمز الدخول: ${code}`,
  });
}

module.exports = { sendWhatsapp };