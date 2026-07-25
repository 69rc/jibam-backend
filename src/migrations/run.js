/**
 * Migration runner — creates all tables in the correct order
 * Run: node src/migrations/run.js
 */
import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../models/index.js';

const runMigrations = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    console.log('🔄 Running migrations (sync with alter)...');
    await sequelize.sync({ alter: true });
    console.log('✅ All tables created/updated successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
