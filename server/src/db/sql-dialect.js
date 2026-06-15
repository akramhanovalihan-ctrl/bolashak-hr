const driver = () => process.env.DB_DRIVER || 'mssql';

/** LIMIT n or FETCH NEXT n ROWS ONLY (MSSQL) */
export function sqlLimit(count) {
  const n = Number(count);
  if (driver() === 'sqlite') return `LIMIT ${n}`;
  return `OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`;
}

/** LIMIT $param or FETCH NEXT $param ROWS ONLY */
export function sqlLimitParam(paramNum) {
  if (driver() === 'sqlite') return `LIMIT $${paramNum}`;
  return `OFFSET 0 ROWS FETCH NEXT $${paramNum} ROWS ONLY`;
}

/** Scalar subquery returning one row: TOP 1 (MSSQL) or LIMIT 1 (SQLite) */
export function sqlScalarSubquery(selectExpr, fromWhere, orderBy = '') {
  const order = orderBy ? ` ORDER BY ${orderBy}` : '';
  if (driver() === 'sqlite') {
    return `(SELECT ${selectExpr} ${fromWhere}${order} LIMIT 1)`;
  }
  return `(SELECT TOP 1 ${selectExpr} ${fromWhere}${order})`;
}
