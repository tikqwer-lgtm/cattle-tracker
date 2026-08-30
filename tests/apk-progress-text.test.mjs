import { describe, it, expect } from 'vitest';
import {
  formatApkProgressDetail,
  uint8ToBase64,
  shouldFallbackApkDownload,
  shouldFallbackApkStall
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

describe('shouldFallbackApkDownload', () => {
  it('opens browser if no bytes arrived in time', () => {
    expect(shouldFallbackApkDownload(0, 12000)).toBe(true);
    expect(shouldFallbackApkDownload(1024, 12000)).toBe(false);
    expect(shouldFallbackApkDownload(0, 3000)).toBe(false);
  });
});

describe('shouldFallbackApkStall', () => {
  it('falls back when progress stopped longer than stall', () => {
    expect(shouldFallbackApkStall(1000, 1000, 13000, 12000)).toBe(true);
    expect(shouldFallbackApkStall(1000, 1000, 5000, 12000)).toBe(false);
    expect(shouldFallbackApkStall(0, 0, 20000, 12000)).toBe(false);
  });
});
