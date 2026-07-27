import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Simple local storage - no compression, no Cloudinary
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  try {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const isValid = allowedTypes.test(file.mimetype);
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed'), false);
    }
  } catch (error) {
    console.error('File filter error:', error);
    cb(error, false);
  }
};

// Export local storage variants
export const uploadProductImages = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB per file, max 5 files
});

export const uploadPrescription = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Simple delete function
export const deleteImage = async (filename) => {
  try {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Image deleted:', filename);
    }
  } catch (error) {
    console.error('Image delete error:', error);
    throw error;
  }
};

// Helper to get public URL for uploaded files
export const getPublicImageUrl = (filename) => {
  return `/uploads/products/${filename}`;
};

// Keep Cloudinary exports for backward compatibility
export default {
  config: () => ({ /* no-op */ }),
  uploader: {
    destroy: () => Promise.resolve({ result: 'ok' })
  }
};
