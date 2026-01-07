import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../src';

describe('Parser', () => {
  it('should parse a valid create block', () => {
    const content = `
@inscribe BEGIN
@inscribe FILE: app/test.js
@inscribe MODE: create

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
@inscribe FILE: app/test.js
@inscribe MODE: range
@inscribe START: // start marker
@inscribe END: // end marker

\`\`\`javascript
// new code
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].mode).toBe('range');
    expect(result.blocks[0].directives.START).toBe('// start marker');
    expect(result.blocks[0].directives.END).toBe('// end marker');
  });

  it('should fail on missing FILE directive', () => {
    const content = `
@inscribe BEGIN
@inscribe MODE: create

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
@inscribe FILE: app/test.js

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
@inscribe FILE: app/test.js
@inscribe MODE: invalid

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
@inscribe FILE: app/test.js
@inscribe MODE: create

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
@inscribe FILE: app/test1.js
@inscribe MODE: create

\`\`\`
content1
\`\`\`

@inscribe END

@inscribe BEGIN
@inscribe FILE: app/test2.js
@inscribe MODE: create

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
@inscribe FILE: app/test.js
@inscribe MODE: create

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
@inscribe FILE: app/correct.js

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
});
