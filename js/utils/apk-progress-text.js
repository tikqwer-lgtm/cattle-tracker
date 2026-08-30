/**
 * Подпись прогресса загрузки APK.
 * Пока байт нет — «Загрузка…»; дальше всегда видны полученные килобайты,
 * даже если сервер не прислал Content-Length.
 */
export var APK_STALL_MS = 12000;

export function shouldFallbackApkDownload(loaded, elapsedMs, stallMs) {
  var got = Number(loaded) || 0;
  var wait = Number(elapsedMs) || 0;
  var limit = stallMs == null ? APK_STALL_MS : Number(stallMs);
  return got <= 0 && wait >= limit;
}

/**
 * Нет прироста байт дольше stallMs (после старта или после последней порции).
 * Нужен, когда AbortController не отменяет зависший запрос в WebView.
 */
export function shouldFallbackApkStall(loaded, lastProgressAtMs, nowMs, stallMs) {
  var limit = stallMs == null ? APK_STALL_MS : Number(stallMs);
  var last = Number(lastProgressAtMs) || 0;
  var now = Number(nowMs) || 0;
  if (!last || now - last < limit) return false;
  return true;
}

export function formatBytes(n) {
  var v = Number(n) || 0;
  if (v < 1024) return v + ' Б';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' КБ';
  return (v / (1024 * 1024)).toFixed(1) + ' МБ';
}

export function formatApkProgressDetail(loaded, total) {
  var got = Number(loaded) || 0;
  var all = Number(total) || 0;
  if (got <= 0) return 'Загрузка…';
  if (all > 0) {
    var pct = Math.min(100, Math.round((100 * got) / all));
    return formatBytes(got) + ' из ' + formatBytes(all) + ' (' + pct + '%)';
  }
  return formatBytes(got);
}

export function uint8ToBase64(u8) {
  var bytes = u8 || new Uint8Array(0);
  var chunk = 0x8000;
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
