// Enhances parsing: if an entry starts with "*",
// it is treated as a parent category for subsequent items
// until the next "*" appears. Returns a flat list by default
// (backwards compatible), and includes grouping metadata
// when requested via options.
export function parseNames(
  namesInput,
  { splitByComma, withHierarchy } = {}
 ) {
  if (!namesInput || typeof namesInput !== "string") return withHierarchy ? { flat: [], groups: [] } : [];
  const pattern = splitByComma ? /\r?\n|,/ : /\r?\n/;

  const tokens = namesInput
    .split(pattern)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  let currentParent = null;
  const flat = [];
  const groups = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("*")) {
      const parentName = t.replace(/^\*+\s*/, "").trim();
      // Empty parent markers are ignored
      if (parentName.length === 0) continue;
      currentParent = parentName;
      // Ensure a group exists for this parent
      let found = false;
      for (let gi = 0; gi < groups.length; gi++) {
        if (groups[gi].parent === currentParent) { found = true; break; }
      }
      if (!found) {
        groups.push({ parent: currentParent, children: [] });
      }
      continue;
    }

    flat.push(t);

    if (currentParent) {
      // Push to the most recent group with this parent (we ensure one exists when setting currentParent)
      for (let gi = groups.length - 1; gi >= 0; gi--) {
        if (groups[gi].parent === currentParent) {
          groups[gi].children.push(t);
          break;
        }
      }
    }
  }

  return withHierarchy ? { flat, groups } : flat;
}
