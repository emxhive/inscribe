import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyChanges } from '../src/apply/applyChanges';

const dirs: string[] = [];
const mk = () => { const d=fs.mkdtempSync(path.join(os.tmpdir(),'inscribe-safe-')); dirs.push(d); return d; };
afterEach(()=>dirs.forEach(d=>fs.rmSync(d,{recursive:true,force:true})));

describe('patch safety pipeline', () => {
  it('blocks invalid candidate before write', () => {
    const root = mk();
    const file = path.join(root, 'app', 'x.tsx');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'export const A = () => <div/>;\n');
    const r = applyChanges({ operations: [{ type: 'replace', file: 'app/x.tsx', content: 'export const A = () => <div>' }] }, root);
    expect(r.success).toBe(false);
    expect(r.errors?.[0]).toContain('INSCRIBE_PARSE_ERROR');
    expect(fs.readFileSync(file, 'utf8')).toBe('export const A = () => <div/>;\n');
  });

  it('replaces textual range safely with explicit END anchor', () => {
    const root = mk();
    const file = path.join(root, 'app', 'x.tsx');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'const x = <Deferred data="participants"><div>ok</div></Deferred>;\n');
    const r = applyChanges({ operations: [{ type: 'range', file: 'app/x.tsx', content: '<section>new</section>', directives: { START: '<Deferred data="participants"', END: '</Deferred>' } }] }, root);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('<section>new</section>');
  });

  it('uses CONTAINS to disambiguate structural ranges', () => {
    const root = mk();
    const file = path.join(root, 'app', 'x.tsx');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '<div><span>ParticipantCard</span></div>\n<div><span>Other</span><span>onRoundChange</span></div>\n');
    const r = applyChanges({ operations: [{ type: 'range', file: 'app/x.tsx', content: '<div>R</div>', directives: { START: '<div', END: '</div>', CONTAINS: 'onRoundChange' } }] }, root);
    expect(r.success).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('<div>R</div>');
  });

  it('replaces full owning declaration with replace_symbol', () => {
    const root = mk();
    const file = path.join(root, 'app', 'x.tsx');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'export const ParticipantSurfacePanel = memo(() => { return <div/>; });\nconst Keep = 1;\n');
    const r = applyChanges({ operations: [{ type: 'replace_symbol' as const, file: 'app/x.tsx', content: 'export const ParticipantSurfacePanel = () => <section/>;\n', directives: { NAME: 'ParticipantSurfacePanel' } }] }, root);
    expect(r.success).toBe(true);
    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain('export const ParticipantSurfacePanel = () => <section/>;');
    expect(out).toContain('const Keep = 1;');
  });
});
