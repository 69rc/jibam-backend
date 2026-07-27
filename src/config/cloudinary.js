import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

// Initialize Supabase client for Storage (separate from Neon DB)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase Storage configuration missing. Image uploads will fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_BUCKET = 'products';

/**
 * Upload file to Supabase Storage
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder path within bucket
 * @returns {Promise<Object>} { url, path, publicId }
 */
export const uploadToSupabase = async (file, folder = '') => {
  try {
    const fileName = folder 
      ? `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}${file.originalname}`
      : `${Date.now()}-${Math.random().toString(36).substring(7)}${file.originalname}`;
    
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      path: fileName,
      publicId: fileName
    };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
};

/**
 * Delete file from Supabase Storage
 * @param {string} publicId - File path in storage
 * @returns {Promise<void>}
 */
export const deleteFromSupabase = async (publicId) => {
  try {
    if (!publicId) return;
    
    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([publicId]);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }

    console.log('File deleted from Supabase:', publicId);
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    // Don't throw error - allow operation to continue even if delete fails
  }
};

/**
 * Get public URL for a file
 * @param {string} publicId - File path in storage
 * @returns {string|null} Public URL
 */
export const getPublicImageUrl = (publicId) => {
  if (!publicId) return null;
  
  const { data } = supabase
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(publicId);
  
  return data.publicUrl;
};

/**
 * Multer configuration for image uploads
 * Uses memory storage (required for Supabase upload)
 */

// Image file filter
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValid = allowedTypes.test(file.mimetype.toLowerCase());
  
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, and WEBP images are allowed'), false);
  }
};

// Product images upload (5MB limit, multiple files)
export const uploadProductImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
});

// Prescription upload (10MB limit, PDF allowed)
export const uploadPrescription = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const isValid = allowedTypes.test(file.mimetype.toLowerCase());
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, WEBP, and PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Avatar upload (2MB limit, images only)
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

// Export delete function
export const deleteImage = deleteFromSupabase;

export default supabase;