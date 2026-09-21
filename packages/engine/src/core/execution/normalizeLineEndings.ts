export function detectDestinationEOL(fileContent: string, payloadContent: string): '\n' | '\r\n' {
  const crlfCount = (fileContent.match(/\r\n/g) || []).length;
  const totalNewlines = (fileContent.match(/\n/g) || []).length;
  const lfCount = totalNewlines - crlfCount;

  if (crlfCount > lfCount) {
    return '\r\n';
  }
  if (lfCount > crlfCount) {
    return '\n';
  }
  if (crlfCount > 0 && crlfCount === lfCount) {
    const firstNewline = fileContent.match(/(\r\n|\n)/)?.[0];
    return firstNewline === '\r\n' ? '\r\n' : '\n';
  }

  const payloadNewline = payloadContent.match(/(\r\n|\n)/)?.[0];
  if (payloadNewline === '\r\n') {
    return '\r\n';
  }
  return '\n'; // Default to LF if payload has no newline
}

export function normalizeLineEndings(content: string, eol: '\n' | '\r\n'): string {
  const lfNormalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (eol === '\r\n') {
    return lfNormalized.replace(/\n/g, '\r\n');
  }
  return lfNormalized;
}
