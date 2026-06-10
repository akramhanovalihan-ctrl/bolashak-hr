const sessions = new Map();

export function getSession(tgId) {
  if (!sessions.has(tgId)) sessions.set(tgId, {});
  return sessions.get(tgId);
}

export function clearSession(tgId) {
  sessions.delete(tgId);
}

export function setSession(tgId, data) {
  sessions.set(tgId, { ...getSession(tgId), ...data });
}
