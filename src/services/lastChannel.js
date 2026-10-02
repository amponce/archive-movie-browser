export const readLast = () => { try { return localStorage.getItem('last-channel'); } catch { return null; } };
export const writeLast = id => { try { localStorage.setItem('last-channel', id); } catch { /* ignore */ } };
