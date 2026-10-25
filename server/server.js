import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './db.js';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole, signUser } from './auth.js';
import { getNotificationSummary, queueNotifications } from './notifications.js';
import { requireChoice, requireText, validBloodTypes, validFinalStatuses, validUrgencies } from './validation.js';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

app.get('/api/health', asyncRoute(async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok', service: 'konekta-raan-api' });
}));

app.post('/api/auth/register', asyncRoute(async (request, response) => {
  const fullName = requireText(request.body.fullName, 'fullName');
  const email = requireText(request.body.email, 'email').toLowerCase();
  const password = requireText(request.body.password, 'password');
  const role = requireChoice(request.body.role, 'role', new Set(['donor', 'recipient']));
  const bloodType = requireChoice(request.body.bloodType, 'bloodType', validBloodTypes);
  const sex = requireText(request.body.sex, 'sex');
  const dateOfBirth = requireText(request.body.dateOfBirth, 'dateOfBirth');
  const municipality = requireText(request.body.municipality, 'municipality');
  const phone = requireText(request.body.phone, 'phone');
  if (password.length < 12) return response.status(400).json({ error: 'Password must be at least 12 characters' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute(
      `INSERT INTO users
        (full_name, email, password_hash, role, sex, date_of_birth, weight_kg, height_cm, municipality, phone, blood_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, passwordHash, role, sex, dateOfBirth, request.body.weightKg || null, request.body.heightCm || null, municipality, phone, bloodType],
    );
    if (role === 'donor') {
      await connection.execute(
        `INSERT INTO donors (full_name, blood_type, municipality, phone, user_id, consent_status)
         VALUES (?, ?, ?, ?, ?, 'Granted')`,
        [fullName, bloodType, municipality, phone, result.insertId],
      );
    }
    await connection.commit();
    const user = { id: result.insertId, full_name: fullName, email, role };
    return response.status(201).json({ data: { token: signUser(user), user } });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'That email is already registered' });
    throw error;
  } finally {
    connection.release();
  }
}));

app.post('/api/auth/login', asyncRoute(async (request, response) => {
  const email = requireText(request.body.email, 'email').toLowerCase();
  const password = requireText(request.body.password, 'password');
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, password_hash, role,
            notification_web_enabled, notification_sms_enabled, blood_type,
            COALESCE((SELECT d.is_active FROM donors d WHERE d.user_id = users.id), 1) AS donor_available
       FROM users
      WHERE email = ? AND is_active = 1`,
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return response.status(401).json({ error: 'Email or password is incorrect' });
  }
  const { password_hash: _passwordHash, ...safeUser } = user;
  response.json({ data: { token: signUser(user), user: safeUser } });
}));

app.get('/api/users/me', requireAuth, asyncRoute(async (request, response) => {
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, role, is_active,
            notification_web_enabled, notification_sms_enabled,
            COALESCE((SELECT d.is_active FROM donors d WHERE d.user_id = users.id), 1) AS donor_available
       FROM users WHERE id = ? AND is_active = 1`,
    [request.user.sub],
  );
  if (!rows[0]) return response.status(404).json({ error: 'User account not found' });
  response.json({ data: rows[0] });
}));

app.get('/api/admin/users', requireAuth, requireRole('admin'), asyncRoute(async (_request, response) => {
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, role, sex, date_of_birth, blood_type,
            municipality, phone, is_active, created_at
       FROM users ORDER BY created_at DESC`,
  );
  response.json({ data: rows });
}));

app.patch('/api/users/me', requireAuth, asyncRoute(async (request, response) => {
  const fullName = requireText(request.body.fullName, 'fullName');
  const email = requireText(request.body.email, 'email').toLowerCase();
  const webEnabled = request.body.notificationWebEnabled === true;
  const smsEnabled = request.body.notificationSmsEnabled === true;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE users
          SET full_name = ?, email = ?,
              notification_web_enabled = ?, notification_sms_enabled = ?
        WHERE id = ? AND is_active = 1`,
      [fullName, email, webEnabled, smsEnabled, request.user.sub],
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return response.status(404).json({ error: 'User account not found' });
    }
    if (request.user.role === 'donor' && typeof request.body.availability === 'boolean') {
      await connection.execute(
        `UPDATE donors SET is_active = ? WHERE user_id = ?`,
        [request.body.availability, request.user.sub],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ error: 'That email is already in use' });
    }
    throw error;
  } finally {
    connection.release();
  }
  const [rows] = await pool.execute(
    `SELECT id, full_name, email, role, is_active,
            notification_web_enabled, notification_sms_enabled,
            COALESCE((SELECT d.is_active FROM donors d WHERE d.user_id = users.id), 1) AS donor_available
       FROM users WHERE id = ?`,
    [request.user.sub],
  );
  response.json({ data: rows[0] });
}));

app.patch('/api/users/me/password', requireAuth, asyncRoute(async (request, response) => {
  const currentPassword = requireText(request.body.currentPassword, 'currentPassword');
  const newPassword = requireText(request.body.newPassword, 'newPassword');
  if (newPassword.length < 12) {
    return response.status(400).json({ error: 'New password must be at least 12 characters' });
  }
  if (currentPassword === newPassword) {
    return response.status(400).json({ error: 'New password must be different' });
  }
  const [rows] = await pool.execute(
    'SELECT password_hash FROM users WHERE id = ? AND is_active = 1',
    [request.user.sub],
  );
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    return response.status(401).json({ error: 'Current password is incorrect' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ? AND is_active = 1',
    [passwordHash, request.user.sub],
  );
  response.json({ data: { updated: true } });
}));

app.get('/api/requests', asyncRoute(async (request, response) => {
  const status = typeof request.query.status === 'string' ? request.query.status : null;
  const [rows] = await pool.execute(
    `SELECT br.id, br.public_id, br.patient_name, br.blood_type, br.hospital_name,
            br.urgency, br.status, br.created_at, br.verified_at,
            COUNT(DISTINCT ml.donor_id) AS match_count
       FROM blood_requests br
       LEFT JOIN match_logs ml ON ml.request_id = br.id
      WHERE (? IS NULL OR br.status = ?)
      GROUP BY br.id
      ORDER BY br.created_at DESC`,
    [status, status],
  );
  response.json({ data: rows });
}));

app.get('/api/dashboard/stats', requireAuth, requireRole('admin'), asyncRoute(async (_request, response) => {
  const [[requestStats]] = await pool.query(
    `SELECT
      SUM(status IN ('Pendente', 'Verifikadu')) AS active_requests,
      SUM(status = 'Pendente') AS pending_requests
     FROM blood_requests`,
  );
  const [[donorStats]] = await pool.query(
    `SELECT COUNT(*) AS available_donors
       FROM donors
      WHERE consent_status = 'Granted' AND is_active = 1`,
  );
  const [[matchStats]] = await pool.query(
    `SELECT
      COUNT(DISTINCT donor_id) AS matched_donors,
      SUM(channel = 'SMS') AS sms_queued,
      SUM(channel = 'Web') AS web_queued
     FROM match_logs
     WHERE created_at >= CURRENT_DATE`,
  );
  response.json({
    data: {
      activeRequests: Number(requestStats.active_requests || 0),
      pendingRequests: Number(requestStats.pending_requests || 0),
      availableDonors: Number(donorStats.available_donors || 0),
      matchedDonors: Number(matchStats.matched_donors || 0),
      smsQueued: Number(matchStats.sms_queued || 0),
      webQueued: Number(matchStats.web_queued || 0),
    },
  });
}));

app.post('/api/requests', requireAuth, requireRole('recipient', 'admin'), asyncRoute(async (request, response) => {
  const patientName = requireText(request.body.patientName, 'patientName');
  const bloodType = requireChoice(request.body.bloodType, 'bloodType', validBloodTypes);
  const hospitalName = requireText(request.body.hospitalName || request.body.location || 'Community request', 'hospitalName');
  const urgency = requireChoice(request.body.urgency, 'urgency', validUrgencies);

  const [result] = await pool.execute(
    `INSERT INTO blood_requests
      (public_id, patient_name, requester_id, blood_type, hospital_name, urgency, status)
     VALUES (UUID(), ?, ?, ?, ?, ?, 'Pendente')`,
    [patientName, request.user.sub, bloodType, hospitalName, urgency],
  );
  const [rows] = await pool.execute(
    'SELECT * FROM blood_requests WHERE id = ?',
    [result.insertId],
  );
  response.status(201).json({ data: rows[0] });
}));

app.patch('/api/requests/:id/verify', requireAuth, requireRole('admin'), asyncRoute(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: 'Request id must be a positive integer' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE blood_requests
          SET status = 'Verifikadu', verified_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'Pendente'`,
      [id],
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return response.status(404).json({ error: 'Pending request not found' });
    }
    const [requestRows] = await connection.execute(
      'SELECT blood_type FROM blood_requests WHERE id = ?',
      [id],
    );
    const notificationSummary = await queueNotifications(connection, id, requestRows[0].blood_type);
    await connection.commit();
    const [rows] = await pool.execute('SELECT * FROM blood_requests WHERE id = ?', [id]);
    return response.json({
      data: { ...rows[0], match_count: notificationSummary.donorCount },
      notifications: notificationSummary,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch('/api/requests/:id/status', requireAuth, requireRole('admin'), asyncRoute(async (request, response) => {
  const id = Number(request.params.id);
  const status = requireChoice(request.body.status, 'status', validFinalStatuses);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: 'Request id must be a positive integer' });
  }
  const [result] = await pool.execute(
    `UPDATE blood_requests
        SET status = ?
      WHERE id = ? AND status = 'Verifikadu'`,
    [status, id],
  );
  if (result.affectedRows === 0) {
    return response.status(404).json({ error: 'Verified request not found' });
  }
  const [rows] = await pool.execute('SELECT * FROM blood_requests WHERE id = ?', [id]);
  response.json({ data: rows[0] });
}));

app.get('/api/requests/:id/notifications', requireAuth, requireRole('admin'), asyncRoute(async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: 'Request id must be a positive integer' });
  }
  response.json({ data: await getNotificationSummary(id) });
}));

app.get('/api/donors/matches', asyncRoute(async (request, response) => {
  const bloodType = requireChoice(request.query.bloodType, 'bloodType', validBloodTypes);
  const municipality = typeof request.query.municipality === 'string'
    ? request.query.municipality.trim()
    : null;
  const [rows] = await pool.execute(
    `SELECT id, full_name, blood_type, municipality, phone
       FROM donors
      WHERE blood_type = ?
        AND consent_status = 'Granted'
        AND is_active = 1
        AND (? IS NULL OR municipality = ?)
      ORDER BY municipality, full_name`,
    [bloodType, municipality || null, municipality || null],
  );
  response.json({ data: rows });
}));

app.post('/api/donors', requireAuth, requireRole('admin', 'donor'), asyncRoute(async (request, response) => {
  const fullName = requireText(request.body.fullName, 'fullName');
  const bloodType = requireChoice(request.body.bloodType, 'bloodType', validBloodTypes);
  const municipality = requireText(request.body.municipality, 'municipality');
  const phone = requireText(request.body.phone, 'phone');
  if (request.body.consent !== true) {
    return response.status(400).json({ error: 'Donor consent is required' });
  }
  if (request.user.role === 'donor') {
    const [existing] = await pool.execute(
      'SELECT id FROM donors WHERE user_id = ?',
      [request.user.sub],
    );
    if (existing[0]) {
      return response.status(409).json({ error: 'This donor account already has a profile' });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO donors
      (full_name, blood_type, municipality, phone, user_id, consent_status)
     VALUES (?, ?, ?, ?, ?, 'Granted')`,
    [fullName, bloodType, municipality, phone, request.user.role === 'donor' ? request.user.sub : null],
  );
  const [rows] = await pool.execute('SELECT * FROM donors WHERE id = ?', [result.insertId]);
  response.status(201).json({ data: rows[0] });
}));

app.use((error, _request, response, _next) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (statusCode >= 500) console.error(error);
  response.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
});

app.listen(port, () => {
  console.log(`Konekta Raan API listening on port ${port}`);
});
