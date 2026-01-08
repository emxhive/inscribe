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
// Using an array for better iteration performance
const KNOWN_DIRECTIVES_ARRAY: Array<{ name: string; key: string | null }> = [
  { name: DIRECTIVE_FILE, key: null }, // Special handling - sets file directly
  { name: DIRECTIVE_MODE, key: null }, // Special handling - sets mode directly
  { name: DIRECTIVE_START, key: 'START' },
  { name: DIRECTIVE_END, key: 'END' },
  { name: DIRECTIVE_SCOPE_START, key: 'SCOPE_START' },
  { name: DIRECTIVE_SCOPE_END, key: 'SCOPE_END' },
];

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
    
    // Determine the directive line to process
    let directiveLine: string;
    
    // Check if line starts with @inscribe prefix (case-insensitive)
    if (startsWithMarker(trimmed, INSCRIBE_PREFIX)) {
      // Extract the directive part after "@inscribe "
      directiveLine = extractMarkerValue(trimmed, INSCRIBE_PREFIX);
    } else {
      // Use the trimmed line as-is (for directives without @inscribe prefix)
      directiveLine = trimmed;
    }
    
    // Try to match against known directives
    let matched = false;
    
    for (const { name: directiveName, key: directiveKey } of KNOWN_DIRECTIVES_ARRAY) {
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
    
    // If no match found and we had a directive-like line, warn but don't fail
    // Only warn if the line started with @inscribe or looks like a directive (has a colon)
    if (!matched && directiveLine && (startsWithMarker(trimmed, INSCRIBE_PREFIX) || directiveLine.includes(':'))) {
      warnings.push(`Unknown directive: ${directiveLine}`);
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
