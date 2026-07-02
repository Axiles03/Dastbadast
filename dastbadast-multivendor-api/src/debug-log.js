// dastbadast-multivendor-api/src/debug-log.js
export function debugLog(scope, message, data) {
  if (data !== undefined) {
    console.log(`[${scope}] ${message}`, data);
  } else {
    console.log(`[${scope}] ${message}`);
  }
}

export function debugWarn(scope, message, data) {
  if (data !== undefined) {
    console.warn(`[${scope}] ${message}`, data);
  } else {
    console.warn(`[${scope}] ${message}`);
  }
}

export function debugError(scope, message, data) {
  if (data !== undefined) {
    console.error(`[${scope}] ${message}`, data);
  } else {
    console.error(`[${scope}] ${message}`);
  }
}
