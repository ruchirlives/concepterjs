import { saveTransitionMetadata as apiSaveTransitionMetadata, loadTransitionMetadata as apiLoadTransitionMetadata } from './api.js';

const generateKey = (containerId, targetId, transitionLabel, direction) =>
  [containerId, targetId, transitionLabel, direction].join('|');

// Cache to avoid frequent API calls
let metadataCache = null;
let cachePromise = null;

export const loadTransitionMetadata = async () => {
  // If we have a cache, return it
  if (metadataCache !== null) {
    return metadataCache;
  }

  // If there's already a loading promise, wait for it
  if (cachePromise) {
    return await cachePromise;
  }

  // Start loading from API
  cachePromise = (async () => {
    try {
      const data = await apiLoadTransitionMetadata();

      // Handle various response formats from backend
      if (!data) {
        // Backend returned null/undefined - no metadata exists yet
        metadataCache = {};
      } else if (data.metadata) {
        // Backend returned {metadata: {...}}
        metadataCache = data.metadata;
      } else if (typeof data === 'object') {
        // Backend returned the metadata object directly
        metadataCache = data;
      } else {
        // Unexpected format, default to empty
        console.warn('Unexpected metadata format from API:', data);
        metadataCache = {};
      }

      return metadataCache;
    } catch (e) {
      console.error('Failed to load transition metadata from API', e);
      metadataCache = {};
      return metadataCache;
    } finally {
      cachePromise = null;
    }
  })();

  return await cachePromise;
};

export const saveTransitionMetadata = async (metadata) => {
  try {
    await apiSaveTransitionMetadata(metadata);
    // Update cache after successful save
    metadataCache = metadata;
  } catch (e) {
    console.error('Failed to save transition metadata to API', e);
    throw e; // Re-throw to let caller handle the error
  }
};

export const getMetadataFor = async (containerId, targetId, transitionLabel, direction) => {
  const metadata = await loadTransitionMetadata();
  return metadata[generateKey(containerId, targetId, transitionLabel, direction)] || {};
};

export const updateMetadataFor = async (
  containerId,
  targetId,
  transitionLabel,
  direction,
  data
) => {
  const metadata = await loadTransitionMetadata();
  const key = generateKey(containerId, targetId, transitionLabel, direction);
  metadata[key] = { ...metadata[key], ...data };
  await saveTransitionMetadata(metadata);
};

export const enrichDiffWithMetadata = async (diff) => {
  // Load all metadata once at the beginning
  const allMetadata = await loadTransitionMetadata();

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

      // Determine direction based on the relationship changes
      const direction = (() => {
        const hasBase = rel.base_relationship_dict;
        const hasCurrent = rel.relationship_dict;

        if (!hasBase && hasCurrent) return 'add';
        if (hasBase && !hasCurrent) return 'remove';
        return 'change';
      })();

      // Use the pre-loaded metadata with direction
      const key = generateKey(cid, tid, transitionLabel, direction);
      const meta = allMetadata[key] || {};

      if (Object.keys(meta).length) {
        Object.assign(rel, meta);
      }
      enriched[cid][tid] = rel;
    });
  });
  return enriched;
};

