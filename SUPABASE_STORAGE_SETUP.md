# Supabase Storage Setup Guide for Neon DB

## Architecture Overview

- **Database**: Neon PostgreSQL (unchanged)
- **Image Storage**: Supabase Storage (separate service)
- **Neon DB stores**: Only public image URLs (no binary data)
- **Supabase Storage stores**: Actual image files

## Quick Setup Steps

### 1. Create Supabase Project (for Storage only)

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it "jibam-pharmacy-storage" (or any name you prefer)
4. Set your database password (you won't use the database, but it's required)
5. Wait for project to be created

### 2. Create Public Storage Bucket

1. In your Supabase project dashboard
2. Click "Storage" in the left sidebar
3. Click "Create a new bucket"
4. Name it exactly: `products`
5. Make it **Public** (so images can be accessed without authentication)
6. Click "Create bucket"

### 3. Get Supabase Storage Credentials

1. Go to Project Settings → API
2. Copy your **Project URL** (SUPABASE_URL)
3. Scroll down to "service_role" → click "Reveal" and copy the key (SUPABASE_SERVICE_ROLE_KEY)

**Important**: Use the `service_role` key, not the `anon` key. The service role key has full access to storage operations.

### 4. Add Environment Variables to Vercel

Add these to your Vercel backend project:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Update Your Local .env

```bash
# Replace with your actual Supabase credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Install Dependencies

```bash
cd backend
npm install
```

### 7. Test Image Upload

- Start your backend locally
- Try uploading a product image in the admin dashboard
- Image should upload to Supabase Storage
- Only the public URL is stored in your Neon DB

## How It Works

### Create Product:
1. Image uploaded to Supabase Storage → `products/` bucket
2. Supabase returns public URL: `https://your-project.supabase.co/storage/v1/object/public/products/image.jpg`
3. Only the URL is saved in Neon DB: `image` column = URL, `imagePublicId` column = storage path

### Update Product:
1. Old image deleted from Supabase Storage (if exists)
2. New image uploaded to Supabase Storage
3. New URL saved in Neon DB

### Delete Product:
1. Images deleted from Supabase Storage
2. Product soft-deleted from Neon DB (isActive = false)

## Benefits of This Architecture

✅ **Neon DB remains unchanged** - Your database stays exactly as is
✅ **Separate storage layer** - Images don't bloat your database
✅ **No compression** - Images keep original quality
✅ **Simple URLs** - Neon DB stores clean public URLs only
✅ **Cost effective** - Supabase Storage free tier: 1GB storage
✅ **Scalable** - Handle unlimited images without database performance impact
✅ **Vercel compatible** - Works perfectly with serverless deployment
✅ **Production ready** - Proper error handling and cleanup

## Storage Limits

- **Free Tier**: 1GB storage, 2GB bandwidth/month
- **Pro Tier**: 100GB storage, 50GB bandwidth/month
- Perfect for product images!

## Database Schema (Unchanged)

Your Neon DB schema remains exactly the same:

```sql
-- Products table
image VARCHAR(500)        -- Stores public URL only
imagePublicId VARCHAR(255) -- Stores Supabase storage path

-- Product images table  
url VARCHAR(500)         -- Stores public URL only
publicId VARCHAR(255)    -- Stores Supabase storage path
```

## For Your Existing Products

Your current products with null images will stay null until you:
1. Edit each product in the admin dashboard
2. Upload an image using the new Supabase Storage
3. Save the product

The old products will work fine without images, and new ones will have images stored in Supabase Storage with URLs in Neon DB.

## Security Notes

- **Service Role Key**: Required for server-side upload/delete operations
- **Public Bucket**: Images are publicly accessible (required for display)
- **No Auth for Image Access**: Images served directly from Supabase CDN
- **Server-Side Only**: Storage operations happen on your backend, not in the browser

## Troubleshooting

### Images not uploading:
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- Ensure the `products` bucket exists and is public
- Check Vercel logs for specific error messages

### Images not displaying:
- Verify the bucket is public
- Check the URL format in your database
- Ensure CORS is configured (handled by Supabase automatically)

### Storage quota exceeded:
- Check Supabase dashboard for storage usage
- Consider upgrading to Pro tier if needed
- Clean up unused images from the bucket