// noinspection DuplicatedCode

import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../src';

describe('Parser', () => {
  it('should parse a valid create block', () => {
    const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: create

\`\`\`javascript
console.log('hello');
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].file).toBe('app/test.js');
    expect(result.blocks[0].mode).toBe('create');
    expect(result.blocks[0].content).toBe("console.log('hello');");
  });

  it('should parse a valid range block', () => {
    const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: range
START_AFTER: // start marker
END_BEFORE: // end marker

\`\`\`javascript
// new code
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].mode).toBe('range');
    expect(result.blocks[0].directives.START_AFTER).toBe('// start marker');
    expect(result.blocks[0].directives.END_BEFORE).toBe('// end marker');
  });

  it('should fail on missing FILE directive', () => {
    const content = `
@inscribe BEGIN
MODE: create

\`\`\`
content
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Missing FILE directive');
  });

  it('should default MODE to replace when missing', () => {
    const content = `
@inscribe BEGIN
FILE: app/test.js

\`\`\`
content
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks[0].mode).toBe('replace');
  });

  it('should fail on invalid MODE', () => {
    const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: invalid

\`\`\`
content
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid MODE');
  });

  it('should fail on unclosed fenced code block', () => {
    const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: create

\`\`\`
content

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('not closed');
  });

  it('should parse multiple blocks', () => {
    const content = `
@inscribe BEGIN
FILE: app/test1.js
MODE: create

\`\`\`
content1
\`\`\`

@inscribe END

@inscribe BEGIN
FILE: app/test2.js
MODE: create

\`\`\`
content2
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].file).toBe('app/test1.js');
    expect(result.blocks[1].file).toBe('app/test2.js');
  });

  it('should ignore text outside blocks', () => {
    const content = `
Some random text here

@inscribe BEGIN
FILE: app/test.js
MODE: create

\`\`\`
content
\`\`\`

@inscribe END

More random text
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
  });

  describe('Fallback mode (without inscribe tags)', () => {
    it('should parse fenced code block with FILE: directive', () => {
      const content = `
Some text here

FILE: app/test.js

\`\`\`javascript
console.log('hello world');
\`\`\`

More text
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].mode).toBe('replace');
      expect(result.blocks[0].content).toBe("console.log('hello world');");
    });

    it('should parse multiple fenced code blocks with FILE: directives', () => {
      const content = `
Some intro text

FILE: app/test1.js

\`\`\`javascript
console.log('first');
\`\`\`

Some middle text

FILE: app/test2.js

\`\`\`javascript
console.log('second');
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].file).toBe('app/test1.js');
      expect(result.blocks[0].content).toBe("console.log('first');");
      expect(result.blocks[1].file).toBe('app/test2.js');
      expect(result.blocks[1].content).toBe("console.log('second');");
    });

    it('should handle FILE: without leading space after colon', () => {
      const content = `
FILE:app/test.js

\`\`\`
content here
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
    });

    it('should ignore fenced blocks without FILE: directive', () => {
      const content = `
Some text

\`\`\`javascript
console.log('orphan');
\`\`\`

FILE: app/test.js

\`\`\`javascript
console.log('valid');
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].content).toBe("console.log('valid');");
    });

    it('should prefer inscribe blocks over fallback mode', () => {
      const content = `
FILE: app/wrong.js

\`\`\`
wrong content
\`\`\`

@inscribe BEGIN
FILE: app/correct.js

\`\`\`
correct content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/correct.js');
      expect(result.blocks[0].content).toBe('correct content');
    });

    it('should fail when no inscribe blocks and no FILE: directives found', () => {
      const content = `
Just some text

\`\`\`javascript
console.log('orphan');
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Case-insensitive and whitespace-tolerant parsing', () => {
    it('should parse BEGIN/END with different cases', () => {
      const content = `
@InScRiBe BeGiN
FILE: app/test.js

\`\`\`
content
\`\`\`

@INSCRIBE END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
    });

    it('should parse directives with extra whitespace', () => {
      const content = `
@inscribe   BEGIN
FILE:   app/test.js
MODE:   create

\`\`\`
content
\`\`\`

@inscribe  END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].mode).toBe('create');
    });

    it('should parse mixed case directive names', () => {
      const content = `
@inscribe BEGIN
FiLe: app/test.js
mode: replace

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].mode).toBe('replace');
    });

    it('should reject prefixed headers and directives', () => {
      const content = `
@inscribe BEGIN
@inscribe FILE: app/test.js
MODE: create

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // Should fail because @inscribe FILE: is invalid
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('FILE');
    });
  });

  describe('Graceful error handling', () => {
    it('should collect multiple errors and continue processing', () => {
      const content = `
@inscribe BEGIN
MODE: create

\`\`\`
content1
\`\`\`

@inscribe END

@inscribe BEGIN
FILE: app/test2.js

\`\`\`
content2
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // First block should fail (no FILE), second should succeed
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test2.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Missing FILE directive'))).toBe(true);
    });

    it('should warn on unknown directives but continue parsing', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
@inscribe UNKNOWN_DIRECTIVE: some value

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.errors.some(e => e.includes('Invalid directive format'))).toBe(true);
    });

    it('should handle invalid MODE gracefully with warning', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: invalid_mode

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].mode).toBe('replace'); // Default mode
      expect(result.errors.some(e => e.includes('Invalid MODE'))).toBe(true);
    });

    it('should handle END without BEGIN and continue', () => {
      const content = `
@inscribe END

@inscribe BEGIN
FILE: app/test.js

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.errors.some(e => e.includes('END without matching BEGIN'))).toBe(true);
    });
  });

  describe('BEGIN inside BEGIN fallback', () => {
    it('should treat second BEGIN as implicit END and start of new block', () => {
      const content = `
@inscribe BEGIN
FILE: app/test1.js

\`\`\`
content1
\`\`\`

@inscribe BEGIN
FILE: app/test2.js

\`\`\`
content2
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // Both blocks should be parsed
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].file).toBe('app/test1.js');
      expect(result.blocks[0].content).toBe('content1');
      expect(result.blocks[1].file).toBe('app/test2.js');
      expect(result.blocks[1].content).toBe('content2');
      
      // Should have a warning about implicit END
      expect(result.errors.some(e => e.includes('BEGIN found without END') && e.includes('implicit END'))).toBe(true);
    });

    it('should handle multiple nested BEGINs', () => {
      const content = `
@inscribe BEGIN
FILE: app/test1.js

\`\`\`
content1
\`\`\`

@inscribe BEGIN
FILE: app/test2.js

\`\`\`
content2
\`\`\`

@inscribe BEGIN
FILE: app/test3.js

\`\`\`
content3
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(3);
      expect(result.blocks[0].file).toBe('app/test1.js');
      expect(result.blocks[1].file).toBe('app/test2.js');
      expect(result.blocks[2].file).toBe('app/test3.js');
    });
  });

  describe('Unclosed blocks at end', () => {
    it('should handle unclosed block at end of content and try to parse it', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js

\`\`\`
content
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      // Block should be parsed despite missing END
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].content).toBe('content');
      
      // Should have error about missing END
      expect(result.errors.some(e => e.includes('BEGIN without matching END'))).toBe(true);
    });

    it('should report error if unclosed block has parsing errors', () => {
      const content = `
@inscribe BEGIN
MODE: create

\`\`\`
content
\`\`\`
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.blocks).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('BEGIN without matching END'))).toBe(true);
      expect(result.errors.some(e => e.includes('Missing FILE directive'))).toBe(true);
    });
  });

  describe('Header and Directive Format Validation', () => {
    it('should accept unprefixed FILE and MODE headers', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: create

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].file).toBe('app/test.js');
      expect(result.blocks[0].mode).toBe('create');
    });

    it('should accept unprefixed directives in range mode', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: range
START: anchor1
END: anchor2

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      expect(result.errors).toEqual([]);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].directives.START).toBe('anchor1');
      expect(result.blocks[0].directives.END).toBe('anchor2');
    });

    it('should reject @inscribe prefixed MODE header', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
@inscribe MODE: create

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // Should have warnings about invalid format  
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Invalid directive format'))).toBe(true);
    });

    it('should reject @inscribe prefixed START directive', () => {
      const content = `
@inscribe BEGIN
FILE: app/test.js
MODE: range
@inscribe START: anchor1
END: anchor2

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // Should have warnings about invalid format
      expect(result.blocks).toHaveLength(1);
      expect(result.errors.some(e => e.includes('Invalid directive format'))).toBe(true);
    });

    it('should reject all prefixed directives and headers', () => {
      const content = `
@inscribe BEGIN
@inscribe FILE: app/test.js
@inscribe MODE: range
@inscribe START: anchor1
@inscribe END: anchor2

\`\`\`
content
\`\`\`

@inscribe END
      `.trim();

      const result = parseBlocks(content);
      
      // Should fail because all directives are prefixed
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('FILE');
    });
  });
});
