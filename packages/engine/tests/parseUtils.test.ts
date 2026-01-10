import { describe, it, expect } from 'vitest';
import { normalizeMarker, matchesMarker, startsWithMarker, extractMarkerValue } from '@shared';

describe('Parse Utilities', () => {
  describe('normalizeMarker', () => {
    it('should normalize whitespace and case', () => {
      expect(normalizeMarker('  @inscribe   BEGIN  ')).toBe('@INSCRIBE BEGIN');
      expect(normalizeMarker('@InScRiBe BEGIN')).toBe('@INSCRIBE BEGIN');
      expect(normalizeMarker('FILE:    test.js')).toBe('FILE: TEST.JS');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeMarker('  @inscribe    FILE:    test.js  ')).toBe('@INSCRIBE FILE: TEST.JS');
    });
  });

  describe('matchesMarker', () => {
    it('should match case-insensitively', () => {
      expect(matchesMarker('@inscribe BEGIN', '@inscribe BEGIN')).toBe(true);
      expect(matchesMarker('@INSCRIBE BEGIN', '@inscribe BEGIN')).toBe(true);
      expect(matchesMarker('@InScRiBe BeGiN', '@inscribe BEGIN')).toBe(true);
    });

    it('should match with different whitespace', () => {
      expect(matchesMarker('  @inscribe   BEGIN  ', '@inscribe BEGIN')).toBe(true);
      expect(matchesMarker('@inscribe  BEGIN', '@inscribe BEGIN')).toBe(true);
    });

    it('should not match different markers', () => {
      expect(matchesMarker('@inscribe BEGIN', '@inscribe END')).toBe(false);
      expect(matchesMarker('FILE: test.js', '@inscribe BEGIN')).toBe(false);
    });
  });

  describe('startsWithMarker', () => {
    it('should match prefixes case-insensitively', () => {
      expect(startsWithMarker('@inscribe FILE: test.js', '@inscribe FILE:')).toBe(true);
      expect(startsWithMarker('@INSCRIBE FILE: test.js', '@inscribe FILE:')).toBe(true);
      expect(startsWithMarker('@InScRiBe FiLe: test.js', '@inscribe FILE:')).toBe(true);
    });

    it('should match with different whitespace', () => {
      expect(startsWithMarker('  @inscribe   FILE:  test.js', '@inscribe FILE:')).toBe(true);
      expect(startsWithMarker('@inscribe  FILE: test.js', '@inscribe FILE:')).toBe(true);
    });

    it('should not match when marker is not at start', () => {
      expect(startsWithMarker('Some text @inscribe FILE:', '@inscribe FILE:')).toBe(false);
    });
  });

  describe('extractMarkerValue', () => {
    it('should extract value after marker', () => {
      expect(extractMarkerValue('@inscribe FILE: test.js', '@inscribe FILE:')).toBe('test.js');
      expect(extractMarkerValue('@inscribe MODE: create', '@inscribe MODE:')).toBe('create');
      expect(extractMarkerValue('FILE: app/test.js', 'FILE:')).toBe('app/test.js');
    });

    it('should handle case-insensitive markers', () => {
      expect(extractMarkerValue('@INSCRIBE FILE: test.js', '@inscribe FILE:')).toBe('test.js');
      expect(extractMarkerValue('@InScRiBe FiLe: test.js', '@inscribe FILE:')).toBe('test.js');
    });

    it('should preserve original case in extracted value', () => {
      expect(extractMarkerValue('@inscribe FILE: TestFile.js', '@inscribe FILE:')).toBe('TestFile.js');
      expect(extractMarkerValue('@INSCRIBE MODE: Create', '@inscribe MODE:')).toBe('Create');
    });

    it('should handle extra whitespace', () => {
      expect(extractMarkerValue('  @inscribe   FILE:    test.js  ', '@inscribe FILE:')).toBe('test.js');
      expect(extractMarkerValue('@inscribe  FILE:  test.js', '@inscribe FILE:')).toBe('test.js');
    });

    it('should return empty string if marker not found', () => {
      expect(extractMarkerValue('Some text', '@inscribe FILE:')).toBe('');
      expect(extractMarkerValue('@inscribe MODE: create', '@inscribe FILE:')).toBe('');
    });

    it('should handle marker without value', () => {
      expect(extractMarkerValue('@inscribe FILE:', '@inscribe FILE:')).toBe('');
      expect(extractMarkerValue('@inscribe FILE:   ', '@inscribe FILE:')).toBe('');
    });
  });
});
