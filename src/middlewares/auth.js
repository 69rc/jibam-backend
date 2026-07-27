import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/index.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Protect route — requires valid JWT
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    
    // Check if JWT secrets are configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');
      return errorResponse(res, 'Server configuration error', 500);
    }
    
    const decoded = verifyAccessToken(token);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
    });

    if (!user) {
      return errorResponse(res, 'User not found. Token invalid.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account has been deactivated. Contact support.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired. Please refresh your token.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    }
    if (error.message === 'secretOrPrivateKey must have a value') {
      return errorResponse(res, 'Server configuration error: JWT secrets not set', 500);
    }
    return errorResponse(res, 'Authentication failed.', 401);
  }
};

/**
 * Restrict to specific roles
 * Usage: restrictTo('admin') or restrictTo('admin', 'customer')
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Required role: ${roles.join(' or ')}.`,
        403
      );
    }
    next();
  };
};

/**
 * Optional auth — attach user if token present but don't fail if not
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
      });
      if (user && user.isActive) req.user = user;
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }
  next();
};
