import { describe, expect, it } from 'vitest';
import { getNextRecentRepositoryIndex } from './recentRepositories';

describe('recent repository keyboard navigation', () => {
  it('wraps through the list and handles an unfocused menu', () => {
    expect(getNextRecentRepositoryIndex(-1, 3, 'next')).toBe(0);
    expect(getNextRecentRepositoryIndex(-1, 3, 'previous')).toBe(2);
    expect(getNextRecentRepositoryIndex(2, 3, 'next')).toBe(0);
    expect(getNextRecentRepositoryIndex(0, 3, 'previous')).toBe(2);
  });

  it('supports Home and End semantics and empty menus', () => {
    expect(getNextRecentRepositoryIndex(1, 3, 'first')).toBe(0);
    expect(getNextRecentRepositoryIndex(1, 3, 'last')).toBe(2);
    expect(getNextRecentRepositoryIndex(-1, 0, 'next')).toBeNull();
  });
});
