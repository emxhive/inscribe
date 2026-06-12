import { describe, expect, it } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadInitialFiles } from './previewV2Workspace';

describe('V2 Real Symlink Escape Tests', () => {
  it('existing symlink escape rejected where platform permits', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-test-'));
    const realRoot = path.join(tempDir, 'repo');
    const outsideDir = path.join(tempDir, 'outside');
    fs.mkdirSync(realRoot);
    fs.mkdirSync(outsideDir);
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'secret');

    const symlinkPath = path.join(realRoot, 'escaped-link.txt');
    try {
      fs.symlinkSync(outsideFile, symlinkPath);
    } catch (e) {
      // Platform does not permit symlink creation, skip test
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    try {
      expect(() => loadInitialFiles(realRoot, ['escaped-link.txt'])).toThrow('WORKSPACE_ESCAPE');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('missing-target parent symlink escape rejected where platform permits', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-test-'));
    const realRoot = path.join(tempDir, 'repo');
    const outsideDir = path.join(tempDir, 'outside');
    fs.mkdirSync(realRoot);
    fs.mkdirSync(outsideDir);

    const symlinkParent = path.join(realRoot, 'escaped-parent');
    try {
      fs.symlinkSync(outsideDir, symlinkParent);
    } catch (e) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    try {
      expect(() => loadInitialFiles(realRoot, ['escaped-parent/missing.txt'])).toThrow('WORKSPACE_ESCAPE');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
