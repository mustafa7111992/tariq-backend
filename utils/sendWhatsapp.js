// utils/sendWhatsapp.js
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TWILIO_CONTENT_SID,
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function sendWhatsapp({ to, code }) {
  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  return client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    contentSid: TWILIO_CONTENT_SID,
    contentVariables: JSON.stringify({ '1': code }),
    to: toWhatsApp,
  });
}

module.exports = { sendWhatsapp };