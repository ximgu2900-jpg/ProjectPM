import { pool } from './db.js';

export async function queueNotifications(connection, requestId, bloodType) {
  const [donors] = await connection.execute(
    `SELECT d.id,
            COALESCE(u.notification_web_enabled, 1) AS web_enabled,
            COALESCE(u.notification_sms_enabled, 1) AS sms_enabled
       FROM donors d
       LEFT JOIN users u ON u.id = d.user_id
      WHERE d.blood_type = ?
        AND d.consent_status = 'Granted'
        AND d.is_active = 1`,
    [bloodType],
  );

  if (donors.length === 0) return { donorCount: 0, queuedCount: 0 };

  const values = [];
  for (const donor of donors) {
    if (donor.web_enabled) values.push([requestId, donor.id, 'Web']);
    if (donor.sms_enabled) values.push([requestId, donor.id, 'SMS']);
  }

  if (values.length > 0) {
    await connection.query(
      `INSERT IGNORE INTO match_logs
        (request_id, donor_id, channel, delivery_status)
       VALUES ?`,
      [values],
    );
  }

  return { donorCount: donors.length, queuedCount: values.length };
}

export async function getNotificationSummary(requestId) {
  const [rows] = await pool.execute(
    `SELECT channel, delivery_status, COUNT(*) AS total
       FROM match_logs
      WHERE request_id = ?
      GROUP BY channel, delivery_status
      ORDER BY channel, delivery_status`,
    [requestId],
  );
  return rows;
}
