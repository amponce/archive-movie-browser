// One request at a time per key in this tab, so two quick writes cannot overwrite each other
const queues = new Map();
export const serial = (key, fn) => {
  const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  queues.set(key, next);
  next.catch(() => {}).then(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
};
