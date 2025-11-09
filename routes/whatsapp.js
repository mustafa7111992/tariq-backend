// routes/whatsapp.js

router.post('/verify-code', async (req, res) => {
  const { phone, code } = req.body;

  try {
    // 1. تحقق من الكود
    const otpRecord = await OTP.findOne({ phone, code });
    
    if (!otpRecord || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'رمز غير صحيح أو منتهي' });
    }

    // 2. تحقق إذا المستخدم موجود
    let user = await User.findOne({ phone });

    // 3. إذا مو موجود، أنشئه (للتسجيل الجديد)
    if (!user && otpRecord.pendingData) {
      user = new User({
        phone: phone,
        name: otpRecord.pendingData.name,
        role: otpRecord.pendingData.role || 'customer',
        isVerified: true,
      });
      await user.save();
      console.log('✅ New user created:', phone);
    } else if (user) {
      // 4. إذا موجود، فقط علّمه كمُتحقق منه
      user.isVerified = true;
      await user.save();
      console.log('✅ Existing user verified:', phone);
    } else {
      return res.status(404).json({ 
        message: 'User not found. Please register first.' 
      });
    }

    // 5. احذف الـ OTP بعد الاستخدام
    await OTP.deleteOne({ _id: otpRecord._id });

    // 6. أرجع المستخدم
    res.status(200).json({
      success: true,
      message: 'تم التحقق بنجاح',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('❌ Verify OTP Error:', error);
    res.status(500).json({ message: 'خطأ في التحقق' });
  }
});