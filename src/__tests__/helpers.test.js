jest.mock("axios");

import { sortBySuccessor } from '../AppContext';

describe('sortBySuccessor utility', () => {
  it('orders successor relationships topologically', () => {
    const items = ['a', 'b', 'c'];
    const relationships = {
      'a--b': { label: 'successor' },
      'b--c': 'successor',
    };
    expect(sortBySuccessor(items, relationships)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to original order when cycle detected', () => {
    const items = ['a', 'b'];
    const relationships = {
      'a--b': 'successor',
      'b--a': 'successor',
    };
    expect(sortBySuccessor(items, relationships)).toEqual(items);
  });
});
