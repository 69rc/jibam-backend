/**
 * Seed runner — populates the database with initial data
 * Run: node src/seeders/run.js
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { sequelize, User, Category, Product, PromoCode } from '../models/index.js';

const seedDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // ─── Admin User ────────────────────────────────────────────────────────
    const adminExists = await User.findOne({ where: { email: process.env.ADMIN_EMAIL } });
    if (!adminExists) {
      await User.create({
        fullname: process.env.ADMIN_FULLNAME || 'Jibam Admin',
        email: process.env.ADMIN_EMAIL || 'admin@jibampharmacy.com',
        phone: '08000000000',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      console.log('✅ Admin user created');
    }

    // ─── Categories ────────────────────────────────────────────────────────
    const categories = [
      { name: 'Antibiotics', description: 'Medicines that kill or inhibit bacterial growth', sortOrder: 1 },
      { name: 'Pain Relief', description: 'Analgesics for pain management', sortOrder: 2 },
      { name: 'Vitamins & Supplements', description: 'Essential vitamins and nutritional supplements', sortOrder: 3 },
      { name: 'Cardiovascular', description: 'Heart and blood pressure medications', sortOrder: 4 },
      { name: 'Diabetes Care', description: 'Medications for diabetes management', sortOrder: 5 },
      { name: 'Skincare', description: 'Topical creams, lotions, and skin treatments', sortOrder: 6 },
      { name: 'Cold & Flu', description: 'Medicines for colds, flu, and respiratory conditions', sortOrder: 7 },
      { name: 'Digestive Health', description: 'Antacids, probiotics, and digestive aids', sortOrder: 8 },
      { name: 'Eye & Ear Care', description: 'Eye drops, ear drops, and related products', sortOrder: 9 },
      { name: 'First Aid', description: 'Bandages, antiseptics, and emergency supplies', sortOrder: 10 },
    ];

    for (const cat of categories) {
      await Category.findOrCreate({
        where: { name: cat.name },
        defaults: cat,
      });
    }
    console.log('✅ Categories seeded');

    // ─── Sample Products ───────────────────────────────────────────────────
    const antibioticsCategory = await Category.findOne({ where: { name: 'Antibiotics' } });
    const painReliefCategory = await Category.findOne({ where: { name: 'Pain Relief' } });
    const vitaminsCategory = await Category.findOne({ where: { name: 'Vitamins & Supplements' } });
    const coldFluCategory = await Category.findOne({ where: { name: 'Cold & Flu' } });

    const products = [
      {
        categoryId: antibioticsCategory.id,
        name: 'Amoxicillin 500mg',
        description: 'Broad-spectrum antibiotic used to treat various bacterial infections including ear, nose, throat, skin, and urinary tract infections.',
        manufacturer: 'GlaxoSmithKline',
        dosage: '500mg capsule',
        price: 2500.00,
        comparePrice: 3000.00,
        stock: 150,
        prescriptionRequired: true,
        isFeatured: true,
        sideEffects: 'Nausea, diarrhea, skin rash, allergic reactions',
        usageInstructions: 'Take 1 capsule every 8 hours with or without food',
        tags: ['antibiotic', 'bacterial infection'],
      },
      {
        categoryId: painReliefCategory.id,
        name: 'Ibuprofen 400mg',
        description: 'Non-steroidal anti-inflammatory drug (NSAID) used for pain relief, fever reduction, and anti-inflammatory purposes.',
        manufacturer: 'Pfizer',
        dosage: '400mg tablet',
        price: 800.00,
        comparePrice: 1000.00,
        stock: 300,
        prescriptionRequired: false,
        isBestSeller: true,
        sideEffects: 'Stomach upset, heartburn, nausea',
        usageInstructions: 'Take 1-2 tablets every 6-8 hours with food',
        tags: ['pain relief', 'fever', 'anti-inflammatory'],
      },
      {
        categoryId: vitaminsCategory.id,
        name: 'Vitamin C 1000mg',
        description: 'High-strength Vitamin C supplement for immune system support, antioxidant protection, and collagen synthesis.',
        manufacturer: 'Nature\'s Way',
        dosage: '1000mg tablet',
        price: 3500.00,
        comparePrice: 4200.00,
        stock: 200,
        prescriptionRequired: false,
        isNewArrival: true,
        isFeatured: true,
        tags: ['vitamin', 'immune', 'antioxidant'],
      },
      {
        categoryId: coldFluCategory.id,
        name: 'Loratadine 10mg',
        description: 'Antihistamine for relief of allergy symptoms including runny nose, sneezing, and itchy eyes.',
        manufacturer: 'Emzor Pharmaceuticals',
        dosage: '10mg tablet',
        price: 1200.00,
        stock: 180,
        prescriptionRequired: false,
        isBestSeller: true,
        tags: ['allergy', 'antihistamine', 'cold'],
      },
      {
        categoryId: painReliefCategory.id,
        name: 'Paracetamol 500mg',
        description: 'Common analgesic and antipyretic used to treat pain and fever. Suitable for adults and children.',
        manufacturer: 'Emzor Pharmaceuticals',
        dosage: '500mg tablet',
        price: 350.00,
        stock: 500,
        prescriptionRequired: false,
        isBestSeller: true,
        isFeatured: true,
        tags: ['paracetamol', 'fever', 'pain'],
      },
    ];

    for (const prod of products) {
      const exists = await Product.findOne({ where: { name: prod.name } });
      if (!exists) await Product.create(prod);
    }
    console.log('✅ Products seeded');

    // ─── Promo Codes ───────────────────────────────────────────────────────
    await PromoCode.findOrCreate({
      where: { code: 'WELCOME10' },
      defaults: {
        discountType: 'percentage',
        discountValue: 10,
        minimumOrder: 2000,
        maxDiscount: 500,
        usageLimit: 1000,
        isActive: true,
      },
    });

    await PromoCode.findOrCreate({
      where: { code: 'SAVE500' },
      defaults: {
        discountType: 'fixed',
        discountValue: 500,
        minimumOrder: 5001,
        usageLimit: 500,
        isActive: true,
      },
    });
    console.log('✅ Promo codes seeded');

    console.log('\n🎉 Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
