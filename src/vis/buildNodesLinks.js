// Generic builder for Sankey nodes/links derived from raw rows and relationships

export function buildNodesLinks(rows, rels, opts = {}) {
  const {
    idKey = 'id', nameKey = 'Name', layerResolver, // function(row) -> category string
    relationshipDelimiter = '--', parentKey = 'ParentId', // optional
    includeOrphans = true,
  } = opts;

  const nodes = [];
  const nodeSet = new Map();
  const ensureNode = (id, name, category) => {
    const sid = id?.toString();
    if (!sid) return null;
    if (!nodeSet.has(sid)) {
      nodeSet.set(sid, true);
      nodes.push({ id: sid, name: name ?? sid, category });
    }
    return sid;
  };

  // Create nodes from rows
  (rows || []).forEach(row => {
    const id = row?.[idKey]?.toString();
    if (!id) return;
    const name = row?.[nameKey] ?? id;
    const category = typeof layerResolver === 'function' ? layerResolver(row) : undefined;
    ensureNode(id, name, category);
  });

  // Build links
  const links = [];
  const addLink = (source, target, value = 1) => {
    const s = source?.toString();
    const t = target?.toString();
    if (!s || !t) return;
    // Ensure endpoints exist (auto-add if requested)
    if (includeOrphans) {
      if (!nodeSet.has(s)) ensureNode(s, s);
      if (!nodeSet.has(t)) ensureNode(t, t);
    } else {
      if (!nodeSet.has(s) || !nodeSet.has(t)) return;
    }
    links.push({ source: s, target: t, value: Number(value) || 1 });
  };

  // From relationships map if available
  if (rels && typeof rels === 'object') {
    Object.entries(rels).forEach(([key, value]) => {
      if (!value) return;
      const parts = key.split(relationshipDelimiter);
      if (parts.length !== 2) return;
      addLink(parts[0], parts[1], value);
    });
  }

  // From ParentId if available in rows
  (rows || []).forEach(row => {
    const childId = row?.[idKey]?.toString();
    const parentId = row?.[parentKey];
    if (parentId != null) addLink(parentId, childId, 1);
  });

  // Break cycles to ensure DAG for d3-sankey
  const adj = new Map();
  links.forEach(({ source, target }) => {
    if (!adj.has(source)) adj.set(source, []);
    adj.get(source).push(target);
  });

  const color = new Map(); // 0=unvisited,1=visiting,2=visited
  const toRemove = new Set();

  const dfs = (u) => {
    color.set(u, 1);
    const nei = adj.get(u) || [];
    for (const v of nei) {
      const c = color.get(v) || 0;
      if (c === 0) {
        dfs(v);
      } else if (c === 1) {
        // back-edge u->v closes a cycle; mark for removal
        toRemove.add(`${u}→${v}`);
      }
    }
    color.set(u, 2);
  };

  Array.from(adj.keys()).forEach(n => { if ((color.get(n) || 0) === 0) dfs(n); });

  const filteredLinks = toRemove.size === 0
    ? links
    : links.filter(l => !toRemove.has(`${l.source}→${l.target}`));

  return { nodes, links: filteredLinks, removedLinks: toRemove.size ? links.filter(l => toRemove.has(`${l.source}→${l.target}`)) : [] };
}
