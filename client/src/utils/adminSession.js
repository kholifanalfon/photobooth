export const ADMIN_SESSION_KEY = 'photobooth_admin_session_unlocked';
export const ADMIN_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function isAdminSessionExpired(timestamp, now = Date.now()) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return now - ts >= ADMIN_SESSION_TIMEOUT_MS;
}

export function readAdminSessionTimestamp(now = Date.now()) {
  const storage = getStorage();
  if (!storage) return 0;

  try {
    const raw = storage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return 0;

    const timestamp = Number(raw);
    if (isAdminSessionExpired(timestamp, now)) {
      storage.removeItem(ADMIN_SESSION_KEY);
      return 0;
    }
    return timestamp;
  } catch (_) {
    return 0;
  }
}

export function touchAdminSession(timestamp = Date.now()) {
  const storage = getStorage();
  const value = Number(timestamp) || Date.now();
  if (storage) {
    try {
      storage.setItem(ADMIN_SESSION_KEY, String(value));
    } catch (_) {}
  }
  return value;
}

export function clearAdminSession() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ADMIN_SESSION_KEY);
    } catch (_) {}
  }
}
