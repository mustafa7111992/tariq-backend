// utils/sendWhatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TWILIO_CONTENT_SID,
} = process.env;

// التحقق من المتغيرات المطلوبة
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
  console.error('Missing required Twilio environment variables');
}

const client = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN 
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

// دالة تضبط الرقم قبل الإرسال
function normalizeToWhatsapp(phone) {
  if (!phone) return null;

  let p = phone.trim().replace(/\s+/g, ''); // إزالة المسافات

  // لو هو already whatsapp:+...
  if (p.startsWith('whatsapp:')) {
    return p;
  }

  // لو هو دولي جاهز +...
  if (p.startsWith('+')) {
    // التحقق من صحة الرقم الدولي
    if (!/^\+[1-9][0-9]{7,14}$/.test(p)) {
      return null; // رقم غير صحيح
    }
    return 'whatsapp:' + p;
  }

  // لو رقم عراقي 07...
  if (p.startsWith('07')) {
    // التحقق من طول الرقم العراقي
    if (p.length !== 11) {
      return null; // رقم عراقي غير صحيح
    }
    p = '+964' + p.slice(1);
    return 'whatsapp:' + p;
  }

  // رقم محلي بدون كود الدولة
  if (/^[0-9]+$/.test(p) && p.length >= 8) {
    return 'whatsapp:+' + p;
  }

  return null; // رقم غير مدعوم
}

async function sendWhatsapp({ to, code }) {
  try {
    // التحقق من إعداد Twilio
    if (!client) {
      throw new Error('Twilio client not initialized - check environment variables');
    }

    const toWhatsApp = normalizeToWhatsapp(to);
    if (!toWhatsApp) {
      throw new Error(`Invalid phone number format: ${to}`);
    }

    console.log(`Sending WhatsApp code to: ${toWhatsApp.replace('whatsapp:', '')}`);

    let result;

    // لو عندك template
    if (TWILIO_CONTENT_SID) {
      result = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        contentSid: TWILIO_CONTENT_SID,
        contentVariables: JSON.stringify({ '1': code }),
        to: toWhatsApp,
      });
      console.log(`WhatsApp sent via template. SID: ${result.sid}`);
    } else {
      // لو ما عندك template ابعث نص عادي
      result = await client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: toWhatsApp,
        body: `رمز التحقق الخاص بك: ${code}\n\nلا تشارك هذا الرمز مع أي شخص آخر.`,
      });
      console.log(`WhatsApp sent via plain text. SID: ${result.sid}`);
    }

    return result;
  } catch (error) {
    console.error('WhatsApp sending failed:', {
      error: error.message,
      code: error.code,
      to: to,
    });
    throw new Error(`Failed to send WhatsApp: ${error.message}`);
  }
}

module.exports = { sendWhatsapp };