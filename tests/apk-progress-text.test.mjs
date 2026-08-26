import { describe, it, expect } from 'vitest';
import {
  formatApkProgressDetail,
  uint8ToBase64
} from '../js/utils/apk-progress-text.js';

describe('formatApkProgressDetail', () => {
  it('does not stay on Загрузка after bytes arrive without Content-Length', () => {
    expect(formatApkProgressDetail(0, 0)).toBe('Загрузка…');
    expect(formatApkProgressDetail(32 * 1024, 0)).toMatch(/КБ/);
    expect(formatApkProgressDetail(32 * 1024, 0)).not.toBe('Загрузка…');
  });

  it('shows percent when total is known', () => {
    expect(formatApkProgressDetail(50, 100)).toMatch(/50%/);
  });
});

describe('uint8ToBase64', () => {
  it('encodes binary for native chunk writes', () => {
    var bytes = new Uint8Array([1, 2, 3, 4]);
    expect(uint8ToBase64(bytes)).toBe(btoa('\x01\x02\x03\x04'));
  });
});
