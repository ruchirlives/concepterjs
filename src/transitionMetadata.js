const STORAGE_KEY = 'transition_metadata';

const generateKey = (sourceState, targetState, containerId, targetId) =>
  [sourceState, targetState, containerId, targetId].join('|');

export const loadTransitionMetadata = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to parse transition metadata', e);
    return {};
  }
};

export const saveTransitionMetadata = (metadata) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  } catch (e) {
    console.error('Failed to save transition metadata', e);
  }
};

export const getMetadataFor = (sourceState, targetState, containerId, targetId) => {
  const metadata = loadTransitionMetadata();
  return metadata[generateKey(sourceState, targetState, containerId, targetId)] || {};
};

export const updateMetadataFor = (sourceState, targetState, containerId, targetId, data) => {
  const metadata = loadTransitionMetadata();
  const key = generateKey(sourceState, targetState, containerId, targetId);
  metadata[key] = { ...metadata[key], ...data };
  saveTransitionMetadata(metadata);
};

export const enrichDiffWithMetadata = (diff, sourceState, targetState) => {
  const enriched = {};
  Object.keys(diff).forEach((cid) => {
    enriched[cid] = {};
    Object.keys(diff[cid]).forEach((tid) => {
      const rel = { ...diff[cid][tid] };
      const meta = getMetadataFor(sourceState, targetState, cid, tid);
      if (Object.keys(meta).length) {
        Object.assign(rel, meta);
      }
      enriched[cid][tid] = rel;
    });
  });
  return enriched;
};

