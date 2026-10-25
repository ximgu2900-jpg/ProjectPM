import 'dotenv/config';
import { pool } from './db.js';
import { getSmsProvider } from './sms-provider.js';
import { backoffSeconds, isTerminalAttempt } from './retry.js';

const intervalMs = Number(process.env.SMS_POLL_INTERVAL_MS || 10000);
const maxAttempts = Number(process.env.SMS_MAX_ATTEMPTS || 5);
let stopping = false;

async function claimBatch() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT ml.id, ml.attempt_count, d.phone, br.patient_name, br.blood_type, br.hospital_name
         FROM match_logs ml
         JOIN donors d ON d.id = ml.donor_id
         JOIN blood_requests br ON br.id = ml.request_id
        WHERE ml.channel = 'SMS'
          AND ml.delivery_status = 'Queued'
          AND ml.attempt_count < ?
          AND (ml.next_attempt_at IS NULL OR ml.next_attempt_at <= CURRENT_TIMESTAMP)
        ORDER BY ml.created_at
        LIMIT 25
        FOR UPDATE SKIP LOCKED`,
      [maxAttempts],
    );
    if (rows.length > 0) {
      await connection.query(
        `UPDATE match_logs
            SET attempt_count = attempt_count + 1,
                next_attempt_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)
          WHERE id IN (?)`,
        [rows.map((row) => row.id)],
      );
    }
    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markSent(id) {
  await pool.execute(
    `UPDATE match_logs
        SET delivery_status = 'Sent', sent_at = CURRENT_TIMESTAMP, next_attempt_at = NULL, last_error = NULL
      WHERE id = ? AND delivery_status = 'Queued'`,
    [id],
  );
}

async function markFailed(id, attempt, error) {
  const terminal = isTerminalAttempt(attempt, maxAttempts);
  await pool.execute(
    `UPDATE match_logs
        SET delivery_status = ?, last_error = ?, next_attempt_at = ?
      WHERE id = ? AND delivery_status = 'Queued'`,
    [terminal ? 'Failed' : 'Queued', String(error.message).slice(0, 500), terminal ? null : new Date(Date.now() + backoffSeconds(attempt) * 1000), id],
  );
}

async function processBatch(provider) {
  const rows = await claimBatch();
  for (const row of rows) {
    const body = `Konekta Raan: Presiza doador ${row.blood_type} ba ${row.patient_name} iha ${row.hospital_name}. Favor kontak requester se ita disponivel.`;
    try {
      await provider.send({ to: row.phone, body });
      await markSent(row.id);
      console.log(`SMS ${row.id} sent via ${provider.name}`);
    } catch (error) {
      await markFailed(row.id, row.attempt_count + 1, error);
      console.error(`SMS ${row.id} failed (attempt ${row.attempt_count + 1}/${maxAttempts}): ${error.message}`);
    }
  }
  return rows.length;
}

const provider = getSmsProvider();
console.log(`SMS worker started with provider=${provider.name}, interval=${intervalMs}ms`);

async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; stopping SMS worker.`);
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

while (!stopping) {
  try {
    await processBatch(provider);
  } catch (error) {
    console.error(`SMS worker cycle failed: ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
