import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../src/parser';

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

  it('should fail on missing MODE directive', () => {
    const content = `
@inscribe BEGIN
@inscribe FILE: app/test.js

\`\`\`
content
\`\`\`

@inscribe END
    `.trim();

    const result = parseBlocks(content);
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Missing MODE directive');
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
});
