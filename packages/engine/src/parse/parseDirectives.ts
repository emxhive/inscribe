/**
 * Functions for parsing Inscribe directives
 */

export interface DirectiveParseResult {
  file: string;
  mode: string;
  directives: Record<string, string>;
  contentStartIndex: number;
  error?: string;
}

/**
 * Parse directives from block lines
 * @param lines - Array of lines containing directives
 * @returns Parsed directives or error
 */
export function parseDirectives(lines: string[]): DirectiveParseResult {
  const directives: Record<string, string> = {};
  let file = '';
  let mode = '';
  let contentStartIndex = -1;
  let unknownDirectiveError: string | undefined;

  // Extract directives
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    if (trimmed.startsWith('```')) {
      contentStartIndex = i;
      break;
    }
    
    if (trimmed.startsWith('@inscribe ')) {
      const directive = trimmed.substring('@inscribe '.length);
      if (directive.startsWith('FILE:')) {
        file = directive.substring('FILE:'.length).trim();
      } else if (directive.startsWith('MODE:')) {
        mode = directive.substring('MODE:'.length).trim();
      } else if (directive.startsWith('START:')) {
        directives.START = directive.substring('START:'.length).trim();
      } else if (directive.startsWith('END:')) {
        directives.END = directive.substring('END:'.length).trim();
      } else if (directive.startsWith('SCOPE_START:')) {
        directives.SCOPE_START = directive.substring('SCOPE_START:'.length).trim();
      } else if (directive.startsWith('SCOPE_END:')) {
        directives.SCOPE_END = directive.substring('SCOPE_END:'.length).trim();
      } else {
        unknownDirectiveError = `Unknown directive: ${directive}`;
        break;
      }
    }
  }

  if (unknownDirectiveError) {
    return { file: '', mode: '', directives: {}, contentStartIndex: -1, error: unknownDirectiveError };
  }

  if (!file) {
    return { file: '', mode: '', directives: {}, contentStartIndex: -1, error: 'Missing FILE directive' };
  }

  if (!mode) {
    mode = 'replace';
  }

  const validModes = ['create', 'replace', 'append', 'range'];
  if (!validModes.includes(mode)) {
    return { 
      file: '', 
      mode: '', 
      directives: {}, 
      contentStartIndex: -1, 
      error: `Invalid MODE: ${mode}. Must be one of: ${validModes.join(', ')}` 
    };
  }

  return { file, mode, directives, contentStartIndex };
}
