/**
 * SheetJS в бандле (без CDN) — window.XLSX для export-import, lists, analytics.
 */
import * as XLSX from 'xlsx';

if (typeof window !== 'undefined') {
  window.XLSX = XLSX;
}

export {};
