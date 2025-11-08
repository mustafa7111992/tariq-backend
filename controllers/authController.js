// هذا Controller deprecated - استخدم whatsappController بدلاً منه
const { sendLoginCode, verifyCode } = require('./whatsappController');

// مجرد wrapper للـ whatsapp controller (للتوافق مع الكود القديم)
exports.sendLoginCode = sendLoginCode;
exports.verifyCode = verifyCode;