import mysql from 'mysql2/promise';
import 'dotenv/config';

const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing database configuration: ${missing.join(', ')}`);
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
});
