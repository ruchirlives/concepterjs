const STORAGE_KEY = 'transition_metadata';

const generateKey = (containerId, targetId, transitionLabel) =>
  [containerId, targetId, transitionLabel].join('|');

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

export const getMetadataFor = (containerId, targetId, transitionLabel) => {
  const metadata = loadTransitionMetadata();
  return metadata[generateKey(containerId, targetId, transitionLabel)] || {};
};

export const updateMetadataFor = (
  containerId,
  targetId,
  transitionLabel,
  data
) => {
  const metadata = loadTransitionMetadata();
  const key = generateKey(containerId, targetId, transitionLabel);
  metadata[key] = { ...metadata[key], ...data };
  saveTransitionMetadata(metadata);
};

export const enrichDiffWithMetadata = (diff) => {
  // Load all metadata once at the beginning
  const allMetadata = loadTransitionMetadata();

  const enriched = {};
  Object.keys(diff).forEach((cid) => {
    enriched[cid] = {};
    Object.keys(diff[cid]).forEach((tid) => {
      const rel = { ...diff[cid][tid] };
      const transitionLabel = (() => {
        const base = rel.base_relationship_dict?.label || 'None';
        const current = rel.relationship_dict?.label || 'None';
        return `${base} -> ${current}`;
      })();

      // Use the pre-loaded metadata instead of calling getMetadataFor
      const key = generateKey(cid, tid, transitionLabel);
      const meta = allMetadata[key] || {};

      if (Object.keys(meta).length) {
        Object.assign(rel, meta);
      }
      enriched[cid][tid] = rel;
    });
  });
  return enriched;
};

