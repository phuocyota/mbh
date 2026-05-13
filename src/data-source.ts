import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pos_system',
  synchronize: false,
  logging: true,
  entities: [join(__dirname, 'src/entities/**/*.entity.ts')],
  migrations: [join(__dirname, 'src/migrations/**/*.ts')],
  subscribers: [],
});
