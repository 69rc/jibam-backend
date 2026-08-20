import crypto from 'crypto';
import { User } from '../models/index.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email.js';

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { fullname, email, phone, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'An account with this email already exists', 409);
    }

    const user = await User.create({ fullname, email, phone, password, role: 'customer' });

    const { accessToken, refreshToken } = generateTokenPair(user);

    // Save refresh token to user
    await user.update({ refreshToken, lastLoginAt: new Date() });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(console.error);

    return successResponse(
      res,
      {
        user: user.toSafeObject(),
        accessToken,
        refreshToken,
      },
      'Account created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return errorResponse(res, 'No account found with this email', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Incorrect password', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated. Contact support.', 403);
    }

    const { accessToken, refreshToken } = generateTokenPair(user);
    await user.update({ refreshToken, lastLoginAt: new Date() });

    return successResponse(res, {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return errorResponse(res, 'Refresh token is required', 400);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return errorResponse(res, 'Invalid or expired refresh token', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.refreshToken !== token) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account deactivated.', 403);
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);
    await user.update({ refreshToken: newRefreshToken });

    return successResponse(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = async (req, res, next) => {
  try {
    await req.user.update({ refreshToken: null });
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Get Profile ──────────────────────────────────────────────────────────────
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
    });
    return successResponse(res, user, 'Profile retrieved');
  } catch (error) {
    next(error);
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const { fullname, phone } = req.body;
    const updateData = {};
    if (fullname) updateData.fullname = fullname;
    if (phone) updateData.phone = phone;
    if (req.file) updateData.avatar = req.file.path; // Cloudinary URL

    await req.user.update(updateData);

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
    });

    return successResponse(res, updatedUser, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    await user.update({ password: newPassword, refreshToken: null });

    return successResponse(res, null, 'Password changed successfully. Please login again.');
  } catch (error) {
    next(error);
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      return successResponse(res, null, 'If this email exists, a reset link has been sent');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.update({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires,
    });

    const resetUrl = `${process.env.CUSTOMER_APP_URL}/reset-password?token=${resetToken}`;
    // Wrap in try/catch so an SMTP failure never breaks the request — the
    // customer always gets a success message (and logs help us debug).
    try {
      await sendPasswordResetEmail(user, resetUrl);
    } catch (emailErr) {
      console.error('[forgotPassword] Failed to send reset email:', emailErr.message);
    }

    return successResponse(res, null, 'If this email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
      },
    });

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return errorResponse(res, 'Invalid or expired reset token', 400);
    }

    await user.update({
      password,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      refreshToken: null,
    });

    return successResponse(res, null, 'Password reset successful. Please login with your new password.');
  } catch (error) {
    next(error);
  }
};
