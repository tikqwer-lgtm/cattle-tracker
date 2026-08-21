/**
 * Чистые хелперы статуса агента (лампочка в шапке и список заявок).
 */

function reportKind(r) {
  if (!r) return '';
  try {
    var pl = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
    return pl && pl.kind ? String(pl.kind) : '';
  } catch (e) {
    return '';
  }
}

function filterPendingImprovements(reports) {
  return (reports || []).filter(function (r) {
    return reportKind(r) === 'improvement' && String(r.status || 'new') === 'new';
  });
}

function pad2(n) {
  return (n < 10 ? '0' : '') + String(n);
}

function formatAgentNextTime(status) {
  if (!status) return '—';
  if (status.phase === 'working') return 'сейчас';
  var next = status.nextPollAt ? Date.parse(status.nextPollAt) : NaN;
  if (!isFinite(next)) return '—';
  var d = new Date(next);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function agentLampState(status, nowMs) {
  nowMs = nowMs == null ? Date.now() : nowMs;
  if (!status || !status.lastSeenAt) return 'unknown';
  var last = Date.parse(status.lastSeenAt);
  if (status.phase === 'working') {
    if (isFinite(last) && nowMs - last > 20 * 60 * 1000) return 'stale';
    return 'working';
  }
  var next = status.nextPollAt ? Date.parse(status.nextPollAt) : NaN;
  if (isFinite(next) && nowMs > next + 10 * 60 * 1000) return 'stale';
  if (isFinite(last)) return 'ok';
  return 'unknown';
}

function agentLampTitle(status, state) {
  var time = formatAgentNextTime(status);
  if (state === 'working') return 'Агент работает. Следующий запрос: ' + time;
  if (state === 'ok') return 'Агент: следующий запрос в ' + time;
  if (state === 'stale') return 'Агент давно не отвечал. Ожидался запрос в ' + time;
  return 'Агент: нет данных о следующем запросе';
}

export {
  reportKind,
  filterPendingImprovements,
  formatAgentNextTime,
  agentLampState,
  agentLampTitle
};
