// Build ancestry tree as flat array: [{id, level, label, parentId}, ...]
export function buildAncestryTree(nodeId, nameById, childrenMap, maxDepth = 6, startingLevel = 0, useChildren = false) {
  const tree = [];

  // Step 1: Add root item at level 0
  if (startingLevel === 0) {
    tree.push({
      id: nodeId,
      level: 0,
      label: nameById[nodeId] || nodeId,
      parentId: null // Root has no parent
    });
  }

  // Step 2: Build levels iteratively
  for (let level = startingLevel; level < maxDepth; level++) {
    // Get all items at current level
    let currentLevelItems = tree.filter(item => item.level === level);

    // Special case: if we're at startingLevel > 0 and there are no items yet, add the starting node
    if (currentLevelItems.length === 0 && level === startingLevel && startingLevel > 0) {
      const startingItem = {
        id: nodeId,
        level: startingLevel,
        label: nameById[nodeId] || nodeId,
        parentId: null // Will be set by the calling function if needed
      };
      tree.push(startingItem);
      // Update currentLevelItems to include the node we just added
      currentLevelItems = [startingItem];
    }

    // If still no items at this level, break
    if (currentLevelItems.length === 0) {
      break;
    }

    // Take the first item of current level
    const firstItem = currentLevelItems[0];

    // Find related ids for next level
    const parentIds = [];
    if (!useChildren) {
      // ancestry upward (parents)
      Object.entries(childrenMap).forEach(([parentId, children]) => {
        if (children.includes(firstItem.id)) {
          parentIds.push(parentId);
        }
      });
    } else {
      // descendants (children)
      const kids = childrenMap[firstItem.id] || [];
      parentIds.push(...kids);
    }


    // Add parents as next level
    parentIds.forEach(parentId => {
      // Check if this parent is already in the tree
      if (!tree.find(item => item.id === parentId)) {
        const parentItem = {
          id: parentId,
          level: level + 1,
          label: nameById[parentId] || parentId,
          parentId: firstItem.id // This parent's child is the firstItem
        };
        tree.push(parentItem);
      }
    });

    if (parentIds.length === 0) {
      break;
    }
  }

  return tree;
}
