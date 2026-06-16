import { describe, expect, it } from 'vitest';
import { scanV2IntakeStructure } from './intakeV2';
import { v2 } from '@inscribe/engine';

describe('scanV2IntakeStructure', () => {
  it('scans create_file block correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
hello world
CONTENT>>>
INSCRIBE>>>`;
    const { blocks, lines } = scanV2IntakeStructure(input);
    expect(blocks.length).toBe(1);
    expect(blocks[0].status).toBe('valid');
    expect(blocks[0].filePath).toBe('src/a.ts');
    expect(blocks[0].mode).toBe('create_file');
    expect(blocks[0].sections?.CONTENT?.isEmpty).toBe(false);

    // Parity with strict parser
    const strictOps = v2.parseInscribeBlocks(input);
    expect(strictOps.length).toBe(1);
    expect(strictOps[0].strategy).toBe('create_file');
  });

  it('scans replace_file block correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_file
<<<CONTENT
new content
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
  });

  it('scans delete_file block correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
  });

  it('scans replace_text block correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_text
<<<SEARCH
old text
SEARCH>>>
<<<CONTENT
new text
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
  });

  it('scans replace_node block correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:MyClass
<<<CONTENT
class MyClass {}
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
  });

  it('scans replace_node with STARTS_WITH correctly', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:MyClass
<<<STARTS_WITH
class MyClass
STARTS_WITH>>>
<<<CONTENT
class MyClass {}
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
  });

  it('handles multiple blocks and arbitrary prose', () => {
    const input = `Some random prose at start.

<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
INSCRIBE>>>

Some intermediate prose.

<<<INSCRIBE
FILE: src/b.ts
MODE: create_file
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks.length).toBe(2);
    expect(blocks[0].status).toBe('valid');
    expect(blocks[0].filePath).toBe('src/a.ts');
    expect(blocks[1].status).toBe('valid');
    expect(blocks[1].filePath).toBe('src/b.ts');
  });

  it('supports LF, CRLF, and CR line endings without text mutation', () => {
    const inputLF = '<<<INSCRIBE\nFILE: src/a.ts\nMODE: delete_file\nINSCRIBE>>>';
    const inputCRLF = '<<<INSCRIBE\r\nFILE: src/a.ts\r\nMODE: delete_file\r\nINSCRIBE>>>';
    const inputCR = '<<<INSCRIBE\rFILE: src/a.ts\rMODE: delete_file\rINSCRIBE>>>';

    expect(scanV2IntakeStructure(inputLF).blocks[0].status).toBe('valid');
    expect(scanV2IntakeStructure(inputCRLF).blocks[0].status).toBe('valid');
    expect(scanV2IntakeStructure(inputCR).blocks[0].status).toBe('valid');
  });

  it('identifies incomplete block', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('incomplete');
    expect(blocks[0].errors).toContain('missing block close');
  });

  it('identifies incomplete section', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
some incomplete content
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('incomplete');
    expect(blocks[0].errors).toContain('missing section close');
  });

  it('survives earlier unterminated section to scan later valid block', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
some content
<<<INSCRIBE
FILE: src/b.ts
MODE: delete_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks.length).toBe(2);
    expect(blocks[0].status).toBe('error');
    expect(blocks[1].status).toBe('valid');
  });

  it('identifies orphan block close', () => {
    const input = `INSCRIBE>>>`;
    const { blocks, lines } = scanV2IntakeStructure(input);
    expect(blocks.length).toBe(1);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('orphan block close');
    expect(lines[0].blockId).toBe(blocks[0].id);
  });

  it('identifies orphan section close', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('orphan section close');
  });

  it('identifies nested block opener', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
<<<INSCRIBE
FILE: src/b.ts
MODE: delete_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks.length).toBe(2);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('nested block opener');
  });

  it('identifies nested section opener', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
content line
<<<SEARCH
search line
SEARCH>>>
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('nested section opener');
  });

  it('identifies mismatched section closer', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
hello
SEARCH>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('mismatched section closer');
  });

  it('identifies unknown directive', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
UNKNOWN: value
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('unknown directive: UNKNOWN');
  });

  it('identifies duplicate directive', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
FILE: src/b.ts
MODE: delete_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('duplicate directive: FILE');
  });

  it('identifies unknown section', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
<<<UNKNOWN
hello
UNKNOWN>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('unknown section: <<<UNKNOWN');
  });

  it('identifies duplicate section', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
hello
CONTENT>>>
<<<CONTENT
world
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('duplicate section: CONTENT');
  });

  it('identifies directive after section', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
<<<CONTENT
hello
CONTENT>>>
MODE: create_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('directive after section');
  });

  it('identifies invalid path', () => {
    const input = `<<<INSCRIBE
FILE: /absolute/path
MODE: delete_file
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('invalid FILE path');
  });

  it('identifies invalid mode', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: invalid_mode
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('invalid MODE');
  });

  it('identifies forbidden sections', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('forbidden section');
  });

  it('identifies missing SELECTOR', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('missing SELECTOR for replace_node');
  });

  it('identifies blank SELECTOR', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: 
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('blank SELECTOR');
  });

  it('identifies blank SEARCH', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_text
<<<SEARCH
SEARCH>>>
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('blank SEARCH');
  });

  it('identifies blank STARTS_WITH', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<STARTS_WITH
STARTS_WITH>>>
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('blank STARTS_WITH');
  });

  it('identifies blank replace_node CONTENT', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<CONTENT
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('blank replace_node CONTENT');
    expect(blocks[0].errors).not.toContain('blank CONTENT');
    expect(blocks[0].errors.filter(e => e.includes('CONTENT'))).toEqual(['blank replace_node CONTENT']);
  });
  it('ignores indexedFileSet in V2 and does not generate warnings', () => {
    // Case 1: create_file with target in indexedFileSet (previously generated warning)
    const inputCreate = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
content
CONTENT>>>
INSCRIBE>>>`;
    const indexedFileSet = new Set(['src/a.ts']);
    const { blocks: blocksCreate } = scanV2IntakeStructure(inputCreate, { indexedFileSet });
    expect(blocksCreate[0].status).toBe('valid');
    expect(blocksCreate[0].warnings).toHaveLength(0);

    // Case 2: non-create operation targeting non-indexed file (previously generated warning)
    const inputReplace = `<<<INSCRIBE
FILE: src/b.ts
MODE: replace_file
<<<CONTENT
content
CONTENT>>>
INSCRIBE>>>`;
    const { blocks: blocksReplace } = scanV2IntakeStructure(inputReplace, { indexedFileSet });
    expect(blocksReplace[0].status).toBe('valid');
    expect(blocksReplace[0].warnings).toHaveLength(0);
  });

  it('bare marker words are treated as payload', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
CONTENT
SEARCH
STARTS_WITH
INSCRIBE
CONTENT>>>
INSCRIBE>>>`;
    const { blocks, lines } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
    // Ensure the payload lines have type 'payload'
    const payloadLines = lines.filter(l => l.type === 'payload');
    expect(payloadLines.length).toBe(4);
    payloadLines.forEach(l => {
      expect(l.status).toBeUndefined();
    });
  });

  it('rejects whitespace-only sections live and strict parser agrees', () => {
    const wsSearch = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_text
<<<SEARCH
   \t  
SEARCH>>>
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const scanSearch = scanV2IntakeStructure(wsSearch);
    expect(scanSearch.blocks[0].status).toBe('error');
    expect(scanSearch.blocks[0].errors).toContain('blank SEARCH');
    expect(() => v2.parseInscribeBlocks(wsSearch)).toThrowError(/EMPTY_SEARCH/);

    const wsStartsWith = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<STARTS_WITH
  
STARTS_WITH>>>
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`;
    const scanSW = scanV2IntakeStructure(wsStartsWith);
    expect(scanSW.blocks[0].status).toBe('error');
    expect(scanSW.blocks[0].errors).toContain('blank STARTS_WITH');
    expect(() => v2.parseInscribeBlocks(wsStartsWith)).toThrowError(/EMPTY_STARTS_WITH/);

    const wsReplaceNodeContent = `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<CONTENT
  \n  
CONTENT>>>
INSCRIBE>>>`;
    const scanRNContent = scanV2IntakeStructure(wsReplaceNodeContent);
    expect(scanRNContent.blocks[0].status).toBe('error');
    expect(scanRNContent.blocks[0].errors).toContain('blank replace_node CONTENT');
    expect(() => v2.parseInscribeBlocks(wsReplaceNodeContent)).toThrowError(/EMPTY_CONTENT/);
  });

  it('preserves arbitrary marker-like text in payload and strict parser accepts them', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
<<<CUSTOM_TOKEN
value>>>
const marker = "thing>>>";
CONTENT>>>
INSCRIBE>>>`;
    const { blocks } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('valid');
    const ops = v2.parseInscribeBlocks(input);
    expect(ops.length).toBe(1);
    const op = ops[0] as { content: string };
    expect(op.content).toContain('<<<CUSTOM_TOKEN');
    expect(op.content).toContain('value>>>');
    expect(op.content).toContain('const marker = "thing>>>";');
  });

  it('surfaces orphan section markers as synthetic blocks', () => {
    const opener = `<<<CONTENT`;
    const scanOpener = scanV2IntakeStructure(opener);
    expect(scanOpener.blocks.length).toBe(1);
    expect(scanOpener.blocks[0].status).toBe('error');
    expect(scanOpener.blocks[0].errors[0]).toBe('orphan section open: CONTENT');
    expect(scanOpener.blocks[0].label).toContain('Orphan section');
    expect(scanOpener.lines[0].blockId).toBe(scanOpener.blocks[0].id);

    const closer = `SEARCH>>>`;
    const scanCloser = scanV2IntakeStructure(closer);
    expect(scanCloser.blocks.length).toBe(1);
    expect(scanCloser.blocks[0].status).toBe('error');
    expect(scanCloser.blocks[0].errors[0]).toBe('orphan section close: SEARCH');
    expect(scanCloser.blocks[0].label).toContain('Orphan section');
    expect(scanCloser.lines[0].blockId).toBe(scanCloser.blocks[0].id);
  });

  it('pushes malformed closer inside block into block errors', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
MALFORMED>>>
INSCRIBE>>>`;
    const { blocks, lines } = scanV2IntakeStructure(input);
    expect(blocks[0].status).toBe('error');
    expect(blocks[0].errors).toContain('unknown section closer: MALFORMED>>>');
    expect(lines[3].type).toBe('section-close');
    expect(lines[3].status).toBe('error');
  });

  it('correctly implements status priority rules', () => {
    // 1. Unfinished block only -> incomplete
    const inputUnfinishedBlock = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file`;
    expect(scanV2IntakeStructure(inputUnfinishedBlock).blocks[0].status).toBe('incomplete');

    // 2. Unfinished section only -> incomplete
    const inputUnfinishedSection = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
hello
INSCRIBE>>>`;
    expect(scanV2IntakeStructure(inputUnfinishedSection).blocks[0].status).toBe('incomplete');

    // 3. Nested opener plus missing close -> error (because nested block opener is a hard malformed error)
    const inputNestedOpener = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
<<<INSCRIBE
FILE: src/b.ts`;
    expect(scanV2IntakeStructure(inputNestedOpener).blocks[0].status).toBe('error');

    // 4. Unknown directive plus missing close -> error
    const inputUnknownDir = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
UNKNOWN: val`;
    expect(scanV2IntakeStructure(inputUnknownDir).blocks[0].status).toBe('error');
  });

  it('validates a table-driven parity suite of valid and malformed blocks', () => {
    const validSamples = [
      {
        name: 'create_file',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
hello
CONTENT>>>
INSCRIBE>>>`
      },
      {
        name: 'replace_file',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_file
<<<CONTENT
world
CONTENT>>>
INSCRIBE>>>`
      },
      {
        name: 'delete_file',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
INSCRIBE>>>`
      },
      {
        name: 'replace_text',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_text
<<<SEARCH
findme
SEARCH>>>
<<<CONTENT
replace
CONTENT>>>
INSCRIBE>>>`
      },
      {
        name: 'replace_node',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<CONTENT
class Foo {}
CONTENT>>>
INSCRIBE>>>`
      },
      {
        name: 'replace_node with STARTS_WITH',
        input: `<<<INSCRIBE
FILE: src/a.ts
MODE: replace_node
SELECTOR: class:Foo
<<<STARTS_WITH
class Foo
STARTS_WITH>>>
<<<CONTENT
class Foo {}
CONTENT>>>
INSCRIBE>>>`
      }
    ];

    for (const sample of validSamples) {
      const scanResult = scanV2IntakeStructure(sample.input);
      expect(scanResult.blocks[0].status).toBe('valid');
      const parseResult = v2.parseInscribeBlocks(sample.input);
      expect(parseResult.length).toBe(1);
    }
  });

  describe('Section-Level Markdown Fence Wrapper scanner integration', () => {
    it('scans blocks with valid wrappers as valid', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: replace_text
<<<SEARCH
\`\`\`php
echo "old";
\`\`\`
SEARCH>>>
<<<CONTENT
\`\`\`php
echo "new";
\`\`\`
CONTENT>>>
INSCRIBE>>>`;

      const { blocks } = scanV2IntakeStructure(input);
      expect(blocks[0].status).toBe('valid');
      expect(blocks[0].errors).toHaveLength(0);
    });

    it('scans blocks with malformed wrappers as error', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file
<<<CONTENT
\`\`\`php
echo "hello";
CONTENT>>>
INSCRIBE>>>`;

      const { blocks } = scanV2IntakeStructure(input);
      expect(blocks[0].status).toBe('error');
      expect(blocks[0].errors).toContain('malformed section wrapper fence: missing closing fence or trailing text after closer');
    });

    it('scans blocks with empty wrappers as empty', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file
<<<CONTENT
\`\`\`php
\`\`\`
CONTENT>>>
INSCRIBE>>>`;

      const { blocks } = scanV2IntakeStructure(input);
      expect(blocks[0].errors).toHaveLength(0);
      expect(blocks[0].sections?.CONTENT?.isEmpty).toBe(true);
    });
  });
});

