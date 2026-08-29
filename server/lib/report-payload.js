/**
 * Разбор payload отчёта: kind=improvement — в работу агенту,
 * kind=suggestion — ждёт «Принять» у администратора.
 */
'use strict';

function parseReportPayload(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    var pl = JSON.parse(String(raw));
    return pl && typeof pl === 'object' && !Array.isArray(pl) ? pl : {};
  } catch (e) {
    return {};
  }
}

function reportKind(raw) {
  var pl = parseReportPayload(raw);
  return pl.kind != null ? String(pl.kind).trim() : '';
}

function isAdminRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase() === 'admin';
}

/** Не-админ не может сразу поставить заявку агенту — только suggestion. */
function kindForSubmit(role, requestedKind) {
  var k = String(requestedKind || '').trim();
  if (k !== 'improvement' && k !== 'suggestion') return k;
  if (!isAdminRole(role)) return 'suggestion';
  return k === 'suggestion' ? 'suggestion' : 'improvement';
}

function payloadAfterAccept(raw) {
  var pl = Object.assign({}, parseReportPayload(raw));
  pl.kind = 'improvement';
  pl.acceptedAt = new Date().toISOString();
  return pl;
}

function isPendingSuggestion(raw, status) {
  return reportKind(raw) === 'suggestion' && String(status || 'new') === 'new';
}

module.exports = {
  parseReportPayload,
  reportKind,
  isAdminRole,
  kindForSubmit,
  payloadAfterAccept,
  isPendingSuggestion
};
