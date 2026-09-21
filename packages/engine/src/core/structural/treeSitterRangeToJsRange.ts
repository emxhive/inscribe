export function treeSitterRangeToJsRange(
  source: string,
  node: { startIndex: number; endIndex: number; text: string }
): { start: number; end: number } {
  const directSlice = source.slice(node.startIndex, node.endIndex);
  if (directSlice === node.text) {
    return { start: node.startIndex, end: node.endIndex };
  }

  return treeSitterByteRangeToJsRange(source, node);
}

/**
 * Converts a logical Tree-sitter byte range into JavaScript UTF-16 offsets.
 *
 * Tree-sitter declaration shapes are not always represented by one node. For
 * example, Dart emits a function signature and its body as sibling nodes, so
 * adapters can provide this range explicitly while keeping the same byte
 * offset conversion used for parser nodes.
 */
export function treeSitterByteRangeToJsRange(
  source: string,
  range: { startIndex: number; endIndex: number },
): { start: number; end: number } {

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
    start: byteToCharIndex[range.startIndex] ?? range.startIndex,
    end: byteToCharIndex[range.endIndex] ?? range.endIndex,
  };
}
