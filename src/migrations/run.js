/**
 * Migration runner — creates / updates all tables via Sequelize sync
 *
 * Local:   node src/migrations/run.js
 * Neon:    DATABASE_URL=postgresql://... node src/migrations/run.js
 */
import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../models/index.js';

const runMigrations = async () => {
  try {
    console.log('🔄 Connecting to database...');
    console.log('   Host:', process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).host
      : `${process.env.DB_HOST}:${process.env.DB_PORT}`);

    await sequelize.authenticate();
    console.log('✅ Connection established\n');

    console.log('🔄 Running sync({ alter: true }) — this creates/updates all tables...');
    await sequelize.sync({ alter: true });

    // List created tables
    const [tables] = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
    );
    console.log(`\n✅ Done! Tables in database (${tables.length}):`);
    tables.forEach((t) => console.log(`   • ${t.tablename}`));

    console.log('\n🎉 Migration complete — run "npm run seed" next to populate data.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.original) console.error('   Original:', error.original.message);
    process.exit(1);
  }
};

runMigrations();
