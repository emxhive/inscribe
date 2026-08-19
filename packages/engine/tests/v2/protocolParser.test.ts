import { describe, it, expect } from 'vitest';
import {
  parseInscribeBlocks,
  parseInscribeBlocksRecovering,
} from '../../src/v2/protocol/parseInscribeBlocks';
import { V2ProtocolError } from '../../src/v2/protocol/protocolErrors';
import { resolvePlan } from '../../src/v2/execution/resolvePlan';

describe('V2 Inscribe Block Parser', () => {
  it('recovers valid blocks before and after an invalid block', () => {
    const input = `<<<INSCRIBE
FILE: first.ts
MODE: create_file
<<<CONTENT
first
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: broken.ts
MODE: unsupported
INSCRIBE>>>
<<<INSCRIBE
FILE: last.ts
MODE: create_file
<<<CONTENT
last
CONTENT>>>
INSCRIBE>>>`;

    const result = parseInscribeBlocksRecovering(input);

    expect(result.operations.map((item) => item.blockIndex)).toEqual([0, 2]);
    expect(result.operations.map((item) => item.operation.filePath)).toEqual(['first.ts', 'last.ts']);
    expect(result.diagnostics).toMatchObject([
      { code: 'INVALID_MODE', blockIndex: 1, filePath: 'broken.ts' },
    ]);
    expect(() => parseInscribeBlocks(input)).toThrowError(/INVALID_MODE/);
  });

  it('resynchronizes at the next block opener after an unterminated block', () => {
    const input = `<<<INSCRIBE
FILE: broken.ts
MODE: delete_file
<<<INSCRIBE
FILE: valid.ts
MODE: create_file
<<<CONTENT
valid
CONTENT>>>
INSCRIBE>>>`;

    const result = parseInscribeBlocksRecovering(input);

    expect(result.diagnostics).toMatchObject([
      { code: 'UNTERMINATED_INSCRIBE_BLOCK', blockIndex: 0, filePath: 'broken.ts' },
    ]);
    expect(result.operations).toMatchObject([
      { blockIndex: 1, operation: { filePath: 'valid.ts' } },
    ]);
  });

  it('reports orphan markers while preserving valid operations', () => {
    const input = `SEARCH>>>
<<<INSCRIBE
FILE: valid.ts
MODE: create_file
<<<CONTENT
valid
CONTENT>>>
INSCRIBE>>>`;

    const result = parseInscribeBlocksRecovering(input);

    expect(result.operations).toHaveLength(1);
    expect(result.diagnostics).toMatchObject([
      { code: 'MALFORMED_MARKER', line: 1 },
    ]);
    expect(() => parseInscribeBlocks(input)).toThrowError(V2ProtocolError);
  });

  it('keeps strict parser diagnostics source-attributed', () => {
    const input = `<<<INSCRIBE
FILE: valid.ts
MODE: delete_file
INSCRIBE>>>
<<<INSCRIBE
FILE: broken.ts
MODE: unsupported
INSCRIBE>>>`;

    try {
      parseInscribeBlocks(input);
      throw new Error('Expected strict parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(V2ProtocolError);
      expect(error).toMatchObject({ code: 'INVALID_MODE', blockIndex: 1, line: 7 });
    }
  });

  it('parses a single create_file block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file

<<<CONTENT
export const value = 1;
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'create_file',
      filePath: 'src/example.ts',
      content: 'export const value = 1;',
    });
  });

  it('parses a single replace_file block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_file

<<<CONTENT
export const value = 2;
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'replace_file',
      filePath: 'src/example.ts',
      content: 'export const value = 2;',
    });
  });

  it('parses a single delete_file block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: delete_file
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'delete_file',
      filePath: 'src/example.ts',
    });
  });

  it('parses a single replace_text block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_text

<<<SEARCH
const value = 1;
SEARCH>>>

<<<CONTENT
const value = 2;
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'replace_text',
      filePath: 'src/example.ts',
      search: 'const value = 1;',
      content: 'const value = 2;',
    });
  });

  it('parses a single replace_node block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue

<<<CONTENT
export function buildValue() {
  return 2;
}
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'replace_node',
      filePath: 'src/example.ts',
      selector: {
        path: [{ kind: 'function', name: 'buildValue' }],
        startsWith: undefined,
      },
      content: 'export function buildValue() {\n  return 2;\n}',
    });
  });

  it('parses a replace_node block with multiline STARTS_WITH', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue > if_statement

<<<STARTS_WITH
if (!value) {
  throw new Error('Missing value');
}
STARTS_WITH>>>

<<<CONTENT
if (!value) {
  throw new Error('Value required');
}
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      strategy: 'replace_node',
      filePath: 'src/example.ts',
      selector: {
        path: [
          { kind: 'function', name: 'buildValue' },
          { kind: 'if_statement' },
        ],
        startsWith: "if (!value) {\n  throw new Error('Missing value');\n}",
      },
      content: "if (!value) {\n  throw new Error('Value required');\n}",
    });
  });

  it('preserves order of multiple sequential blocks', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file

<<<CONTENT
a
CONTENT>>>
INSCRIBE>>>

Some prose in between...

<<<INSCRIBE
FILE: src/b.ts
MODE: create_file

<<<CONTENT
b
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(2);
    expect(ops[0].filePath).toBe('src/a.ts');
    expect(ops[1].filePath).toBe('src/b.ts');
  });

  it('preserves indentation, blank lines, and trailing spaces in payloads', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file

<<<CONTENT
  class Test {
    run() {
      // trailing spaces follow${' '.repeat(3)}
      return 1;
    }
  }
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect(ops[0]).toHaveProperty('content');
    const content = (ops[0] as any).content;
    expect(content).toBe(`  class Test {
    run() {
      // trailing spaces follow${' '.repeat(3)}
      return 1;
    }
  }`);
  });

  it('preserves LF, CRLF and additional leading/trailing newlines in payload exactly', () => {
    const inputLF = "<<<INSCRIBE\nFILE: src/example.ts\nMODE: create_file\n\n<<<CONTENT\n\n\nline1\nline2\n\nCONTENT>>>\nINSCRIBE>>>";
    const opsLF = parseInscribeBlocks(inputLF);
    expect((opsLF[0] as any).content).toBe("\n\nline1\nline2\n");

    const inputCRLF = "<<<INSCRIBE\r\nFILE: src/example.ts\r\nMODE: create_file\r\n\r\n<<<CONTENT\r\n\r\nline1\r\n\r\nCONTENT>>>\r\nINSCRIBE>>>";
    const opsCRLF = parseInscribeBlocks(inputCRLF);
    expect((opsCRLF[0] as any).content).toBe("\r\nline1\r\n");
  });

  it('ignores arbitrary prose outside blocks', () => {
    const input = `Hello world
this is random text.
<<<INSCRIBE
FILE: src/example.ts
MODE: delete_file
INSCRIBE>>>
some more trailing prose.`;

    const ops = parseInscribeBlocks(input);
    expect(ops).toHaveLength(1);
  });

  it('throws NO_INSCRIBE_BLOCKS when no blocks exist', () => {
    const input = 'just some prose';
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /NO_INSCRIBE_BLOCKS/
    );
  });

  it('throws UNEXPECTED_CONTENT when invalid text is found inside active block', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
hello bad content here
MODE: delete_file
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /UNEXPECTED_CONTENT/
    );
  });

  it('throws UNEXPECTED_CONTENT when directive appears after a section has started', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
<<<CONTENT
some code
CONTENT>>>
MODE: replace_file
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /UNEXPECTED_CONTENT/
    );
  });

  it('rejects duplicate directives', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
FILE: src/other.ts
MODE: delete_file
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /DUPLICATE_DIRECTIVE/
    );
  });

  it('rejects duplicate sections', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
<<<CONTENT
a
CONTENT>>>
<<<CONTENT
b
CONTENT>>>
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /DUPLICATE_SECTION/
    );
  });

  it('rejects unknown directives', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: delete_file
UNKNOWN: value
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /UNKNOWN_DIRECTIVE/
    );
  });

  it('rejects unknown sections', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
<<<BADSECTION
abc
BADSECTION>>>
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /UNKNOWN_SECTION/
    );
  });

  it('rejects invalid mode', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: invalid_mode
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /INVALID_MODE/
    );
  });

  it('rejects missing required field', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /MISSING_REQUIRED_FIELD/
    );
  });

  it('rejects forbidden fields', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: delete_file
<<<CONTENT
forbidden
CONTENT>>>
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(
      /FORBIDDEN_FIELD/
    );
  });

  it('rejects blank FILE, SELECTOR, SEARCH, STARTS_WITH', () => {
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: \nMODE: delete_file\nINSCRIBE>>>`)).toThrowError(/INVALID_FILE_PATH/);
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: replace_node\nSELECTOR: \n<<<CONTENT\na\nCONTENT>>>\nINSCRIBE>>>`)).toThrowError(/EMPTY_SELECTOR/);
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: replace_text\n<<<SEARCH\n \nSEARCH>>>\n<<<CONTENT\na\nCONTENT>>>\nINSCRIBE>>>`)).toThrowError(/EMPTY_SEARCH/);
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: replace_node\nSELECTOR: function:buildValue\n<<<STARTS_WITH\n\nSTARTS_WITH>>>\n<<<CONTENT\na\nCONTENT>>>\nINSCRIBE>>>`)).toThrowError(/EMPTY_STARTS_WITH/);
  });

  it('rejects blank replace_node CONTENT', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue
<<<CONTENT
${' '.repeat(3)}
CONTENT>>>
INSCRIBE>>>`;
    expect(() => parseInscribeBlocks(input)).toThrowError(/EMPTY_CONTENT/);
  });

  it('rejects unsafe paths', () => {
    const testPath = (p: string) => {
      const input = `<<<INSCRIBE\nFILE: ${p}\nMODE: delete_file\nINSCRIBE>>>`;
      parseInscribeBlocks(input);
    };

    expect(() => testPath('/absolute')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('C:/windows')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('//unc/path')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src\\backslashes')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src/./a')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src/../a')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src//a')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src/a/')).toThrowError(/INVALID_FILE_PATH/);
    expect(() => testPath('src/a\u0000b')).toThrowError(/INVALID_FILE_PATH/);
  });

  it('rejects unterminated blocks, unterminated sections, and malformed markers', () => {
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: delete_file`)).toThrowError(/UNTERMINATED_INSCRIBE_BLOCK/);
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: create_file\n<<<CONTENT\nhello\nINSCRIBE>>>`)).toThrowError(/UNTERMINATED_SECTION/);
    expect(() => parseInscribeBlocks(`<<<INSCRIBE\nFILE: src/a.ts\nMODE: delete_file\nINSCRIBE>>>someExtraStuff`)).toThrowError(/MALFORMED_MARKER/);
  });

  it('preserves ordinary lines with marker words and requires exact ending sentinel on its own line', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file

<<<CONTENT
This is a line containing CONTENT
And this one contains SEARCH
But this line is CONTENT>>>
This is also content
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    expect((ops[0] as any).content).toBe(`This is a line containing CONTENT
And this one contains SEARCH
But this line is CONTENT>>>
This is also content`);
  });

  it('wraps structural selector-parser failures as INVALID_SELECTOR', () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue > invalidKind:foo

<<<CONTENT
export const value = 1;
CONTENT>>>
INSCRIBE>>>`;

    expect(() => parseInscribeBlocks(input)).toThrowError(
      /INVALID_SELECTOR/
    );
  });

  it('passes parsed operations sequence to resolvePlan', async () => {
    const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file

<<<CONTENT
export const value = 1;
CONTENT>>>
INSCRIBE>>>

<<<INSCRIBE
FILE: src/example.ts
MODE: replace_text

<<<SEARCH
export const value = 1;
SEARCH>>>

<<<CONTENT
export const value = 2;
CONTENT>>>
INSCRIBE>>>`;

    const ops = parseInscribeBlocks(input);
    const initialFiles = new Map<string, { content: string; exists: boolean }>();
    const plan = await resolvePlan(ops, initialFiles);

    expect(plan.errors).toHaveLength(0);
    expect(plan.executions).toHaveLength(2);
    expect(plan.executions[0].afterContent).toBe('export const value = 1;');
    expect(plan.executions[1].afterContent).toBe('export const value = 2;');
  });

  describe('Hardening - Reserved Markers Inside Open Sections', () => {
    it('fails when CONTENT is unterminated before INSCRIBE>>>', () => {
      const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
<<<CONTENT
some code
INSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(
        /UNTERMINATED_SECTION/
      );
    });

    it('fails when CONTENT is unterminated and cannot swallow a later valid block', () => {
      const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
some code

<<<INSCRIBE
FILE: src/b.ts
MODE: create_file
<<<CONTENT
other code
CONTENT>>>
INSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(
        /UNTERMINATED_SECTION/
      );
    });

    it('fails when nested <<<SEARCH appears while CONTENT is open', () => {
      const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
<<<CONTENT
code
<<<SEARCH
more code
CONTENT>>>
INSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(
        /MALFORMED_MARKER/
      );
    });

    it('fails when mismatched SEARCH>>> appears while CONTENT is open', () => {
      const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file
<<<CONTENT
code
SEARCH>>>
CONTENT>>>
INSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(
        /MALFORMED_MARKER/
      );
    });
  });

  describe('Hardening - Path Validation', () => {
    it.each([
      ['src/a:b.ts', 'contains invalid character: :'],
      ['src/a?.ts', 'contains invalid character: ?'],
      ['src/a*.ts', 'contains invalid character: *'],
      ['src/a".ts', 'contains invalid character: "'],
      ['src/a<.ts', 'contains invalid character: <'],
      ['src/a>.ts', 'contains invalid character: >'],
      ['src/a|.ts', 'contains invalid character: |'],
      ['src/folder./a.ts', 'ends with dot'],
      ['src/folder /a.ts', 'ends with space'],
    ])('rejects unsafe path %s', (pathStr) => {
      const input = `<<<INSCRIBE\nFILE: ${pathStr}\nMODE: delete_file\nINSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(
        /INVALID_FILE_PATH/
      );
    });
  });

  describe('Hardening - Protocol Error Metadata', () => {
    it('populates correct metadata when second block fails', () => {
      const input = `<<<INSCRIBE
FILE: src/first.ts
MODE: delete_file
INSCRIBE>>>

<<<INSCRIBE
FILE: src/second.ts
MODE: replace_node
SELECTOR:${' '.repeat(1)}
<<<CONTENT
code
CONTENT>>>
INSCRIBE>>>`;

      try {
        parseInscribeBlocks(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(V2ProtocolError);
        expect(err.code).toBe('EMPTY_SELECTOR');
        expect(err.blockIndex).toBe(1);
        expect(err.line).toBe(9); // SELECTOR line is line 9
      }
    });
  });

  describe('Hardening - Paired-marker Collisions', () => {
    it('proves exact bare payload lines remain content', () => {
      const input = `<<<INSCRIBE
FILE: src/example.ts
MODE: create_file

<<<CONTENT
CONTENT
SEARCH
STARTS_WITH
INSCRIBE
CONTENT>>>
INSCRIBE>>>`;

      const ops = parseInscribeBlocks(input);
      expect((ops[0] as any).content).toBe('CONTENT\nSEARCH\nSTARTS_WITH\nINSCRIBE');
    });
  });

  describe('Hardening - Empty Content Policy', () => {
    it('allows empty CONTENT for create_file, replace_file, replace_text', () => {
      const inputCreate = `<<<INSCRIBE\nFILE: a.ts\nMODE: create_file\n<<<CONTENT\nCONTENT>>>\nINSCRIBE>>>`;
      expect(parseInscribeBlocks(inputCreate)[0]).toEqual({
        strategy: 'create_file',
        filePath: 'a.ts',
        content: '',
      });

      const inputReplace = `<<<INSCRIBE\nFILE: a.ts\nMODE: replace_file\n<<<CONTENT\nCONTENT>>>\nINSCRIBE>>>`;
      expect(parseInscribeBlocks(inputReplace)[0]).toEqual({
        strategy: 'replace_file',
        filePath: 'a.ts',
        content: '',
      });

      const inputReplaceText = `<<<INSCRIBE\nFILE: a.ts\nMODE: replace_text\n<<<SEARCH\nfindme\nSEARCH>>>\n<<<CONTENT\nCONTENT>>>\nINSCRIBE>>>`;
      expect(parseInscribeBlocks(inputReplaceText)[0]).toEqual({
        strategy: 'replace_text',
        filePath: 'a.ts',
        search: 'findme',
        content: '',
      });
    });

    it('rejects empty or whitespace CONTENT for replace_node', () => {
      const input = `<<<INSCRIBE\nFILE: a.ts\nMODE: replace_node\nSELECTOR: function:foo\n<<<CONTENT\nCONTENT>>>\nINSCRIBE>>>`;
      expect(() => parseInscribeBlocks(input)).toThrowError(/EMPTY_CONTENT/);
    });
  });

  describe('Section-Level Markdown Fence Wrapper Support', () => {
    it('unwraps valid code fences inside sections', () => {
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

      const ops = parseInscribeBlocks(input);
      expect(ops).toHaveLength(1);
      expect(ops[0]).toEqual({
        strategy: 'replace_text',
        filePath: 'src/example.php',
        search: 'echo "old";',
        content: 'echo "new";',
      });
    });

    it('unwraps tilde code fences with leading whitespace up to 3 spaces', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: replace_text

<<<SEARCH
   ~~~php
   echo "old";
   ~~~
SEARCH>>>

<<<CONTENT
~~~
echo "new";
~~~
CONTENT>>>
INSCRIBE>>>`;

      const ops = parseInscribeBlocks(input);
      expect(ops[0]).toEqual({
        strategy: 'replace_text',
        filePath: 'src/example.php',
        search: '   echo "old";',
        content: 'echo "new";',
      });
    });

    it('throws MALFORMED_WRAPPER_FENCE when section starts with fence but lacks closing fence', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file

<<<CONTENT
\`\`\`php
echo "hello";
CONTENT>>>
INSCRIBE>>>`;

      expect(() => parseInscribeBlocks(input)).toThrowError(/MALFORMED_WRAPPER_FENCE/);
    });

    it('throws MALFORMED_WRAPPER_FENCE when closing fence is shorter than opening fence', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file

<<<CONTENT
\`\`\`\`php
echo "hello";
\`\`\`
CONTENT>>>
INSCRIBE>>>`;

      expect(() => parseInscribeBlocks(input)).toThrowError(/MALFORMED_WRAPPER_FENCE/);
    });

    it('throws MALFORMED_WRAPPER_FENCE when non-blank text appears after the closing fence', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file

<<<CONTENT
\`\`\`php
echo "hello";
\`\`\`
some explanation prose
CONTENT>>>
INSCRIBE>>>`;

      expect(() => parseInscribeBlocks(input)).toThrowError(/MALFORMED_WRAPPER_FENCE/);
    });

    it('does not unwrap and treats as literal when opening fence has 4+ leading spaces', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file

<<<CONTENT
    \`\`\`php
    echo "hello";
    \`\`\`
CONTENT>>>
INSCRIBE>>>`;

      const ops = parseInscribeBlocks(input);
      expect(ops[0]).toEqual({
        strategy: 'create_file',
        filePath: 'src/example.php',
        content: '    ```php\n    echo "hello";\n    ```',
      });
    });

    it('preserves internal fences inside body but unwraps wrapper fences', () => {
      const input = `<<<INSCRIBE
FILE: src/example.php
MODE: create_file

<<<CONTENT
\`\`\`markdown
Here is code:
\`\`\`javascript
const x = 1;
\`\`\`
\`\`\`
CONTENT>>>
INSCRIBE>>>`;

      const ops = parseInscribeBlocks(input);
      expect(ops[0].content).toBe('Here is code:\n```javascript\nconst x = 1;\n```');
    });
  });
});

