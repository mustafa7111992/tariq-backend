// config/firebase.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  // لو عندك JSON key حقيقي من Firebase حطّه بالمتغير ENV
  // أو حطه مباشرة هنا (بس الأفضل ENV)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // تشغيل بدون كريدنشل حقيقية (راح يفشل verifyIdToken بالمناسبة)
    admin.initializeApp();
  }
}

module.exports = admin;