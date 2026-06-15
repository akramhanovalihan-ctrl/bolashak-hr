import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const serverHost = process.env.SQLSERVER_HOST || 'localhost\\SQLEXPRESS';

const config = {
  server: serverHost.includes('\\') ? serverHost.split('\\')[0] : serverHost,
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DATABASE || 'bolashak_hr',
  user: process.env.SQLSERVER_USER || 'sa',
  password: process.env.SQLSERVER_PASSWORD || '',
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
    instanceName: serverHost.includes('\\') ? serverHost.split('\\')[1] : undefined,
    enableArithAbort: true,
  },
};

let pool = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export async function query(text, params = []) {
  const p = await getPool();
  const request = p.request();

  params.forEach((value, index) => {
    request.input(`p${index + 1}`, value);
  });

  let sqlText = text;
  for (let i = params.length; i >= 1; i--) {
    sqlText = sqlText.replace(new RegExp(`\\$${i}(?:::[\\w.]+)?`, 'g'), `@p${i}`);
  }

  const result = await request.query(sqlText);
  return { rows: result.recordset || [] };
}

export async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { sql };
