const registry = new Map();

export const registerStateSetter = (key, setter) => {
  if (typeof key !== "string" || key.length === 0) return;
  if (typeof setter !== "function") return;
  registry.set(key, setter);
};

export const unregisterStateSetter = (key, setter) => {
  if (typeof key !== "string" || key.length === 0) return;
  const current = registry.get(key);
  if (current && (!setter || current === setter)) {
    registry.delete(key);
  }
};

export const getStateSetter = (key) => {
  if (typeof key !== "string" || key.length === 0) return undefined;
  return registry.get(key);
};
