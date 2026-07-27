import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate JWT secrets are configured
 */
const validateJWTSecrets = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not configured');
  }
};

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (payload) => {
  try {
    validateJWTSecrets();
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'jibam-pharmacy',
      audience: 'jibam-pharmacy-app',
    });
  } catch (error) {
    console.error('Error generating access token:', error);
    throw error;
  }
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (payload) => {
  try {
    validateJWTSecrets();
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'jibam-pharmacy',
      audience: 'jibam-pharmacy-app',
    });
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw error;
  }
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not configured');
    }
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'jibam-pharmacy',
      audience: 'jibam-pharmacy-app',
    });
  } catch (error) {
    console.error('Error verifying access token:', error);
    throw error;
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not configured');
    }
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'jibam-pharmacy',
      audience: 'jibam-pharmacy-app',
    });
  } catch (error) {
    console.error('Error verifying refresh token:', error);
    throw error;
  }
};

/**
 * Generate both tokens for a user
 */
export const generateTokenPair = (user) => {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  } catch (error) {
    console.error('Error generating token pair:', error);
    throw error;
  }
};
