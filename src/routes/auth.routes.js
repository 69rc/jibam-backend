import { Router } from 'express';
import {
  register, login, refreshToken, logout,
  getProfile, updateProfile, changePassword,
  forgotPassword, resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import {
  registerValidator, loginValidator, forgotPasswordValidator,
  resetPasswordValidator, changePasswordValidator, updateProfileValidator,
} from '../validators/auth.validators.js';
import { uploadAvatar } from '../config/cloudinary.js';

const router = Router();

router.post('/register', authLimiter, registerValidator, validate, register);
router.post('/login', authLimiter, loginValidator, validate, login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

router.use(protect);
router.post('/logout', logout);
router.get('/profile', getProfile);
router.put('/profile', uploadAvatar.single('avatar'), updateProfileValidator, validate, updateProfile);
router.put('/change-password', changePasswordValidator, validate, changePassword);

export default router;
