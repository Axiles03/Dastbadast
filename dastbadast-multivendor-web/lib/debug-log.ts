const PREFIX = '[Dastbadast]';

/** Логи в консоль браузера (F12 → Console). Включены всегда в dev и при ?debug=1 */
export function debugLog(scope: string, message: string, data?: unknown) {
  if (typeof window === 'undefined') return;
  const force = new URLSearchParams(window.location.search).get('debug') === '1';
  if (process.env.NODE_ENV !== 'development' && !force) return;
  if (data !== undefined) {
    console.log(`${PREFIX} [${scope}] ${message}`, data);
  } else {
    console.log(`${PREFIX} [${scope}] ${message}`);
  }
}

export function debugWarn(scope: string, message: string, data?: unknown) {
  if (typeof window === 'undefined') return;
  if (data !== undefined) {
    console.warn(`${PREFIX} [${scope}] ${message}`, data);
  } else {
    console.warn(`${PREFIX} [${scope}] ${message}`);
  }
}

export function debugError(scope: string, message: string, data?: unknown) {
  if (typeof window === 'undefined') return;
  if (data !== undefined) {
    console.error(`${PREFIX} [${scope}] ${message}`, data);
  } else {
    console.error(`${PREFIX} [${scope}] ${message}`);
  }
}
