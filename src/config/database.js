import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Support both a full DATABASE_URL (e.g. Railway/Render/Supabase/Neon)
// OR individual DB_* environment variables.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production'
          ? { require: true, rejectUnauthorized: false }
          : false,
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
      define: { timestamps: true, underscored: false },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        dialectOptions: {
          ssl: process.env.NODE_ENV === 'production'
            ? { require: true, rejectUnauthorized: false }
            : false,
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
        define: { timestamps: true, underscored: false },
      }
    );

export default sequelize;
