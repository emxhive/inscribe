/**
 * Functions for parsing Inscribe directives
 */

import {
  DIRECTIVE_FILE,
  DIRECTIVE_MODE,
  DIRECTIVE_START,
  DIRECTIVE_END,
  DIRECTIVE_SCOPE_START,
  DIRECTIVE_SCOPE_END,
  INSCRIBE_PREFIX,
  VALID_MODES,
  DEFAULT_MODE,
  startsWithMarker,
  extractMarkerValue,
  isValidMode,
  type Mode,
} from '@inscribe/shared';

export interface DirectiveParseResult {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  contentStartIndex: number;
  error?: string;
  warnings?: string[];
}

// Map of directive names to their keys in the directives object
const KNOWN_DIRECTIVES: Record<string, string | null> = {
  [DIRECTIVE_FILE]: null, // Special handling - sets file directly
  [DIRECTIVE_MODE]: null, // Special handling - sets mode directly
  [DIRECTIVE_START]: 'START',
  [DIRECTIVE_END]: 'END',
  [DIRECTIVE_SCOPE_START]: 'SCOPE_START',
  [DIRECTIVE_SCOPE_END]: 'SCOPE_END',
};

/**
 * Parse directives from block lines
 * @param lines - Array of lines containing directives
 * @returns Parsed directives with file, mode, and optional warnings
 */
export function parseDirectives(lines: string[]): DirectiveParseResult {
  const directives: Record<string, string> = {};
  const warnings: string[] = [];
  let file = '';
  let mode: Mode = DEFAULT_MODE;
  let contentStartIndex = -1;

  // Extract directives
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Check for start of code fence
    if (trimmed.startsWith('```')) {
      contentStartIndex = i;
      break;
    }
    
    // Check if line starts with @inscribe prefix (case-insensitive)
    if (startsWithMarker(trimmed, INSCRIBE_PREFIX)) {
      // Extract the directive part after "@inscribe "
      const directiveLine = extractMarkerValue(trimmed, INSCRIBE_PREFIX);
      
      // Try to match against known directives
      let matched = false;
      
      for (const [directiveName, directiveKey] of Object.entries(KNOWN_DIRECTIVES)) {
        if (startsWithMarker(directiveLine, directiveName)) {
          matched = true;
          const value = extractMarkerValue(directiveLine, directiveName);
          
          // Handle special directives
          if (directiveName === DIRECTIVE_FILE) {
            file = value;
          } else if (directiveName === DIRECTIVE_MODE) {
            if (isValidMode(value)) {
              mode = value;
            } else {
              warnings.push(`Invalid MODE: ${value}. Using default: ${DEFAULT_MODE}`);
              mode = DEFAULT_MODE;
            }
          } else if (directiveKey) {
            // Regular directive - store in directives object
            directives[directiveKey] = value;
          }
          break;
        }
      }
      
      // If no match found, warn but don't fail
      if (!matched && directiveLine) {
        warnings.push(`Unknown directive: ${directiveLine}`);
      }
    }
  }

  if (!file) {
    return { 
      file: '', 
      mode: DEFAULT_MODE, 
      directives: {}, 
      contentStartIndex: -1, 
      error: 'Missing FILE directive' 
    };
  }

  return { file, mode, directives, contentStartIndex, warnings: warnings.length > 0 ? warnings : undefined };
}
