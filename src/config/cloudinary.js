import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For Vercel serverless, use memory storage and store as base64
// For local development, use disk storage
const useMemoryStorage = process.env.VERCEL === '1';

let uploadsDir;
if (!useMemoryStorage) {
  uploadsDir = path.join(__dirname, '../../uploads/products');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory:', uploadsDir);
    }
  } catch (error) {
    console.error('Failed to create uploads directory:', error);
  }
}

// Use memory storage for Vercel, disk storage for local
const storage = useMemoryStorage 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
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

// Export upload functions
export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

export const uploadPrescription = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Helper to convert file to base64 for database storage
export const fileToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

// Helper to get public URL
export const getPublicImageUrl = (filename) => {
  if (useMemoryStorage) {
    // For memory storage, URL will be base64 data URL
    return null; // Will be handled differently
  }
  return `/uploads/products/${filename}`;
};

// Delete function (works for disk storage only)
export const deleteImage = async (filename) => {
  if (useMemoryStorage) {
    console.log('Memory storage - delete not applicable');
    return;
  }
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

export default {
  config: () => ({ /* no-op */ }),
  uploader: {
    destroy: () => Promise.resolve({ result: 'ok' })
  }
};
