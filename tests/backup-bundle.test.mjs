import { describe, it, expect } from 'vitest';
import {
  buildBackupZip,
  restoreBackupZip,
  parseLegacyBackupJson,
  backupZipFilename
} from '../js/features/backup-bundle.js';

describe('backup-bundle', () => {
  it('builds and restores ZIP with all layers', () => {
    const payload = {
      objectId: 'default',
      objectName: 'Тест',
      appVersion: '0.6.5',
      entries: [{ cattleId: '1', nickname: 'Бурёнка' }],
      stall_layout: { yards: { A: { rows: 2, cols: 3 } } },
      farm_card: { contacts: [], addresses: [] },
      farm_settings: {
        technicians: ['Иванов'],
        bulls: ['Бык-1'],
        drugs: ['ПГ'],
        protocols: [{ id: 'p1', name: 'Овсинх', steps: [] }]
      }
    };
    const zip = buildBackupZip(payload);
    expect(zip).toBeInstanceOf(Uint8Array);
    expect(zip.length).toBeGreaterThan(100);

    const applied = { entries: null, card: null, settings: null, stall: null };
    const result = restoreBackupZip(zip, {
      applyFarmCard: (d) => { applied.card = d; },
      applyFarmSettings: (d) => { applied.settings = d; },
      applyEntries: (d) => { applied.entries = d; },
      applyStallLayout: (d) => { applied.stall = d; }
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toContain('herd/entries.json');
    expect(result.applied).toContain('farm-card.json');
    expect(applied.entries).toHaveLength(1);
    expect(applied.entries[0].cattleId).toBe('1');
    expect(applied.settings.technicians).toContain('Иванов');
    expect(applied.stall.yards.A.rows).toBe(2);
  });

  it('partial restore skips missing files', () => {
    const zip = buildBackupZip({
      objectId: 'x',
      objectName: 'X',
      entries: [],
      farm_card: {},
      farm_settings: { technicians: [], bulls: [], drugs: [], protocols: [] }
    });
    const unzippedOnlyEntries = restoreBackupZip(zip, {
      applyEntries: () => {}
    });
    expect(unzippedOnlyEntries.skipped.length).toBeGreaterThan(0);
  });

  it('parses legacy JSON', () => {
    const legacy = parseLegacyBackupJson(JSON.stringify({
      entries: [{ cattleId: '99' }],
      stall_layout: { yards: {} }
    }));
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.entries[0].cattleId).toBe('99');
  });

  it('backupZipFilename sanitizes name', () => {
    const name = backupZipFilename('Ферма / №1');
    expect(name).toMatch(/^cattle-tracker-/);
    expect(name.endsWith('.zip')).toBe(true);
    expect(name).not.toContain('/');
  });
});
