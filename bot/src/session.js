const sessions = new Map();

function sessionKey(tgId) {
  return Number(tgId);
}

export function getSession(tgId) {
  const key = sessionKey(tgId);
  if (!sessions.has(key)) sessions.set(key, {});
  return sessions.get(key);
}

export function clearSession(tgId) {
  sessions.delete(sessionKey(tgId));
}

export function setSession(tgId, data) {
  const key = sessionKey(tgId);
  sessions.set(key, { ...getSession(key), ...data });
}
