export function findAllOccurrences(content: string, search: string): number[] {
  const positions: number[] = [];
  let pos = content.indexOf(search);
  while (pos !== -1) {
    positions.push(pos);
    pos = content.indexOf(search, pos + 1);
  }
  return positions;
}
