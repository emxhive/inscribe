export type RecentRepositoryNavigation = 'next' | 'previous' | 'first' | 'last';

export function getNextRecentRepositoryIndex(
  currentIndex: number,
  itemCount: number,
  navigation: RecentRepositoryNavigation,
): number | null {
  if (itemCount <= 0) return null;
  if (navigation === 'first') return 0;
  if (navigation === 'last') return itemCount - 1;
  if (currentIndex < 0) return navigation === 'next' ? 0 : itemCount - 1;
  if (navigation === 'next') return (currentIndex + 1) % itemCount;
  return (currentIndex - 1 + itemCount) % itemCount;
}
