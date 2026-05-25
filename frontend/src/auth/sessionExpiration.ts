const SESSION_EXPIRATION_STORAGE_KEY = "library.auth.session-expired";

export function markSessionExpired() {
  window.sessionStorage.setItem(SESSION_EXPIRATION_STORAGE_KEY, "1");
}

export function consumeSessionExpiredNotice() {
  const shouldShowNotice = window.sessionStorage.getItem(SESSION_EXPIRATION_STORAGE_KEY) === "1";
  if (!shouldShowNotice) {
    return "";
  }

  window.sessionStorage.removeItem(SESSION_EXPIRATION_STORAGE_KEY);
  return "Tu sesión ha expirado. Inicia sesión de nuevo.";
}
