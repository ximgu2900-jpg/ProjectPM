import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [email, password, fullName, role = 'admin'] = process.argv.slice(2);
const validRoles = new Set(['admin', 'donor', 'recipient']);

if (!email || !password || !fullName || !validRoles.has(role) || password.length < 12) {
  console.error('Usage: npm run create-user -- email password "Full Name" [admin|donor|recipient]');
  console.error('Password must be at least 12 characters.');
  process.exitCode = 1;
} else {
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, LOWER(?), ?, ?)`,
    [fullName, email, passwordHash, role],
  );
  console.log(`Created ${role} user: ${email.toLowerCase()}`);
  await pool.end();
}
