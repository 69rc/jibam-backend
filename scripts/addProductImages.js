/**
 * Script to add images to existing products
 * Run: node scripts/addProductImages.js
 */

import { Product } from '../src/models/index.js';
import dotenv from 'dotenv';

dotenv.config();

const productsToUpdate = [
  {
    id: 'aac7c297-19d3-492c-abf1-2aee5fcc5c06',
    name: 'Paracetamol 500mg',
    // Add image URL here
    image: 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v123/paracetamol.jpg',
    imagePublicId: 'paracetamol'
  },
  {
    id: '516ffb56-ccd3-4c22-b443-5650d48c59f4',
    name: 'Loratadine 10mg',
    // Add image URL here
    image: 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v123/loratadine.jpg',
    imagePublicId: 'loratadine'
  },
  {
    id: '6bf2147c-efd3-4d3e-a853-59e54d755b23',
    name: 'Vitamin C 1000mg',
    // Add image URL here
    image: 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v123/vitamin-c.jpg',
    imagePublicId: 'vitamin-c'
  },
  {
    id: 'b3b9dc1c-893e-4068-9236-ad53a736edc8',
    name: 'Ibuprofen 400mg',
    // Add image URL here
    image: 'https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v123/ibuprofen.jpg',
    imagePublicId: 'ibuprofen'
  }
];

async function addProductImages() {
  try {
    console.log('Starting to add images to products...');
    
    for (const productData of productsToUpdate) {
      const product = await Product.findByPk(productData.id);
      if (product) {
        await product.update({
          image: productData.image,
          imagePublicId: productData.imagePublicId
        });
        console.log(`✅ Updated image for ${productData.name}`);
      } else {
        console.log(`❌ Product not found: ${productData.name}`);
      }
    }
    
    console.log('✅ All products updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating products:', error);
    process.exit(1);
  }
}

addProductImages();