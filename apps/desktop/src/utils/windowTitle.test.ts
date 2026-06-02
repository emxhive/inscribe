import { describe, expect, it } from 'vitest';
import { getRepoDisplayName, getWindowTitle } from './windowTitle';

describe('windowTitle', () => {
  it('uses the app title when no repository is bound', () => {
    expect(getWindowTitle(null)).toBe('Inscribe');
    expect(getWindowTitle('')).toBe('Inscribe');
  });

  it('uses the repository folder name for Windows paths', () => {
    expect(getRepoDisplayName('C:\\Users\\okpak\\GItHub\\inscribe')).toBe('inscribe');
    expect(getWindowTitle('C:\\Users\\okpak\\GItHub\\inscribe')).toBe('inscribe - Inscribe');
  });

  it('handles normalized paths and trailing separators', () => {
    expect(getRepoDisplayName('/home/okpak/projects/client-app/')).toBe('client-app');
    expect(getWindowTitle('/home/okpak/projects/client-app/')).toBe('client-app - Inscribe');
  });
});
