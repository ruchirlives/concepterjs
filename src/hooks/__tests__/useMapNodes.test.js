jest.mock("axios");

import {
  buildParentChildLookup,
  buildNodeLookup,
  getTopLevelNodes,
} from '../useMapNodes';

describe('useMapNodes helpers', () => {
  it('builds parent-child lookup structures', () => {
    const raw = [
      { container_id: 'parent1', children: [{ id: 'child1' }, 'child2'] },
      { container_id: 'parent2', children: [] },
    ];
    const { parentToChildren, childIds } = buildParentChildLookup(raw);
    expect(parentToChildren.get('parent1')).toHaveLength(2);
    expect(childIds.has('child1')).toBe(true);
    expect(childIds.has('child2')).toBe(true);
  });

  it('creates a node lookup keyed by id', () => {
    const nodes = [
      { id: 'one', name: 'One' },
      { id: 'two', name: 'Two' },
    ];
    const lookup = buildNodeLookup(nodes);
    expect(lookup.get('one')).toEqual(nodes[0]);
    expect(lookup.get('two')).toEqual(nodes[1]);
  });

  it('filters top-level nodes based on child ids and selected layer', () => {
    const nodes = [
      { id: 'a', Tags: 'alpha' },
      { id: 'child', Tags: 'beta' },
    ];
    const childIds = new Set(['child']);
    let filtered = getTopLevelNodes(nodes, childIds, null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a');

    filtered = getTopLevelNodes(nodes, childIds, 'beta');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('child');
  });
});
