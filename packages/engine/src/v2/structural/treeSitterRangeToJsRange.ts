export function treeSitterRangeToJsRange(
  source: string,
  node: { startIndex: number; endIndex: number; text: string }
): { start: number; end: number } {
  const directSlice = source.slice(node.startIndex, node.endIndex);
  if (directSlice === node.text) {
    return { start: node.startIndex, end: node.endIndex };
  }

  // Fallback: UTF-8 byte offset to UTF-16 code unit mapping
  const encoder = new TextEncoder();
  const bytes = encoder.encode(source);

  const byteToCharIndex = new Int32Array(bytes.length + 1);
  let charIndex = 0;
  let byteIndex = 0;

  while (charIndex < source.length) {
    const codePoint = source.codePointAt(charIndex)!;
    const charLength = codePoint > 0xffff ? 2 : 1;
    const sliceStr = source.slice(charIndex, charIndex + charLength);
    const utf8Length = encoder.encode(sliceStr).length;

    for (let i = 0; i < utf8Length; i++) {
      byteToCharIndex[byteIndex + i] = charIndex;
    }
    byteIndex += utf8Length;
    charIndex += charLength;
  }
  byteToCharIndex[byteIndex] = source.length;

  return {
    start: byteToCharIndex[node.startIndex] ?? node.startIndex,
    end: byteToCharIndex[node.endIndex] ?? node.endIndex,
  };
}
