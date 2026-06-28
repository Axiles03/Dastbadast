export const storage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, value); } catch {}
  },
  remove(key: string) {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(key); } catch {}
  },
};
