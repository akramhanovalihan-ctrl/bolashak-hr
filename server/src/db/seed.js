import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { closePool, getPool, query, sql } from './index.js';

const UNITS = [
  { code: 'store_bajova', name: 'Магазин Бажова', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168 },
  { code: 'store_menovnoe', name: 'Магазин Меновное', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168 },
  { code: 'store_bolshenarym', name: 'Магазин Большенарым', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168 },
  { code: 'store_orc', name: 'Магазин ОРЦ', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168 },
  { code: 'store_domino', name: 'Магазин Домино', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168 },
  { code: 'rc_ust', name: 'РЦ (распред. центр)', unit_type: 'warehouse', schedule_type: 'shift_mixed', hours_norm_default: 176 },
  { code: 'office_aup', name: 'АУП', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160 },
  { code: 'office_marketing', name: 'Маркетинг', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160 },
  { code: 'office_fin', name: 'Бухгалтерия/Финансы', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160 },
  { code: 'it', name: 'IT', unit_type: 'office', schedule_type: 'flexible', hours_norm_default: 160 },
  { code: 'security', name: 'СБ (служба безопасности)', unit_type: 'security', schedule_type: 'shift', hours_norm_default: 168 },
];

const USERS = [
  { email: 'aizada@bolashak.local', full_name: 'Айзада Меирманова', role: 'admin', password: 'admin123' },
  { email: 'talshyn@bolashak.local', full_name: 'Талшын', role: 'hr', password: 'hr123' },
  { email: 'galina@bolashak.local', full_name: 'Галина', role: 'finance', password: 'fin123' },
  { email: 'alihan@bolashak.local', full_name: 'Алихан', role: 'manager', password: 'it123', unit_code: 'it' },
  { email: 'aidyn@bolashak.local', full_name: 'Айдын', role: 'manager', password: 'it123', unit_code: 'it' },
];

const driver = process.env.DB_DRIVER || 'mssql';

async function upsertUserSqlite(user, hash) {
  const existing = await query('SELECT id FROM hr_users WHERE email = $1', [user.email]);
  if (existing.rows[0]) {
    await query(
      'UPDATE hr_users SET password_hash = $1, full_name = $2, role = $3 WHERE email = $4',
      [hash, user.full_name, user.role, user.email]
    );
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await query(
    'INSERT INTO hr_users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)',
    [id, user.email, hash, user.full_name, user.role]
  );
  return id;
}

async function upsertUnitSqlite(unit) {
  const existing = await query('SELECT id FROM hr_units WHERE code = $1', [unit.code]);
  if (existing.rows[0]) {
    await query(
      `UPDATE hr_units SET name = $1, unit_type = $2, schedule_type = $3, hours_norm_default = $4 WHERE code = $5`,
      [unit.name, unit.unit_type, unit.schedule_type, unit.hours_norm_default, unit.code]
    );
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await query(
    `INSERT INTO hr_units (id, code, name, unit_type, schedule_type, hours_norm_default)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, unit.code, unit.name, unit.unit_type, unit.schedule_type, unit.hours_norm_default]
  );
  return id;
}

async function seedSqlite() {
  const userIds = {};
  for (const user of USERS) {
    const hash = await bcrypt.hash(user.password, 12);
    userIds[user.email] = await upsertUserSqlite(user, hash);
  }

  const unitIds = {};
  for (const unit of UNITS) {
    unitIds[unit.code] = await upsertUnitSqlite(unit);
  }

  for (const user of USERS) {
    if (user.unit_code && unitIds[user.unit_code]) {
      await query('UPDATE hr_users SET unit_id = $1 WHERE email = $2', [unitIds[user.unit_code], user.email]);
    }
  }
}

async function seedMssql() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const userIds = {};
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 12);
      const request = new sql.Request(transaction);
      request.input('email', sql.NVarChar(100), user.email);
      request.input('password_hash', sql.NVarChar(sql.MAX), hash);
      request.input('full_name', sql.NVarChar(200), user.full_name);
      request.input('role', sql.NVarChar(20), user.role);

      const { recordset } = await request.query(`
        MERGE hr.hr_users AS t
        USING (SELECT @email AS email, @password_hash AS password_hash, @full_name AS full_name, @role AS role) AS s
        ON t.email = s.email
        WHEN MATCHED THEN
          UPDATE SET password_hash = s.password_hash, full_name = s.full_name, role = s.role
        WHEN NOT MATCHED THEN
          INSERT (email, password_hash, full_name, role) VALUES (s.email, s.password_hash, s.full_name, s.role)
        OUTPUT INSERTED.id, INSERTED.email;
      `);
      userIds[user.email] = recordset[0].id;
    }

    const unitIds = {};
    for (const unit of UNITS) {
      const request = new sql.Request(transaction);
      request.input('code', sql.NVarChar(50), unit.code);
      request.input('name', sql.NVarChar(100), unit.name);
      request.input('unit_type', sql.NVarChar(20), unit.unit_type);
      request.input('schedule_type', sql.NVarChar(20), unit.schedule_type);
      request.input('hours_norm_default', sql.Int, unit.hours_norm_default);

      const { recordset } = await request.query(`
        MERGE hr.hr_units AS t
        USING (
          SELECT @code AS code, @name AS name, @unit_type AS unit_type,
                 @schedule_type AS schedule_type, @hours_norm_default AS hours_norm_default
        ) AS s
        ON t.code = s.code
        WHEN MATCHED THEN
          UPDATE SET name = s.name, unit_type = s.unit_type,
                     schedule_type = s.schedule_type, hours_norm_default = s.hours_norm_default
        WHEN NOT MATCHED THEN
          INSERT (code, name, unit_type, schedule_type, hours_norm_default)
          VALUES (s.code, s.name, s.unit_type, s.schedule_type, s.hours_norm_default)
        OUTPUT INSERTED.id, INSERTED.code;
      `);
      unitIds[unit.code] = recordset[0].id;
    }

    for (const user of USERS) {
      if (user.unit_code && unitIds[user.unit_code]) {
        const request = new sql.Request(transaction);
        request.input('unit_id', sql.UniqueIdentifier, unitIds[user.unit_code]);
        request.input('email', sql.NVarChar(100), user.email);
        await request.query('UPDATE hr.hr_users SET unit_id = @unit_id WHERE email = @email');
      }
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function seed() {
  if (driver === 'sqlite') {
    await seedSqlite();
  } else {
    await seedMssql();
  }

  console.log(`Seeded ${UNITS.length} units and ${USERS.length} users (${driver})`);
  console.log('Demo logins: aizada@bolashak.local / admin123');
  await closePool();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
