/**
 * Лампочка агента в шапке: опрос GET /api/admin/agent-status.
 */
import {
  agentLampState,
  agentLampTitle,
  formatAgentNextTime
} from './agent-status-format.js';

(function (global) {
  'use strict';

  var POLL_MS = 30000;
  var pollTimer = null;
  var lastStatus = null;

  function isAppAdminUser() {
    var u = null;
    if (typeof global.getCurrentUser === 'function') {
      try {
        u = global.getCurrentUser();
      } catch (e) {}
    }
    if (!u) return false;
    return String(u.role || '').trim().toLowerCase() === 'admin';
  }

  function lampClassForState(state) {
    if (state === 'working' || state === 'ok') return 'connection-indicator--connected';
    if (state === 'stale') return 'connection-indicator--stale';
    return 'connection-indicator--disconnected';
  }

  function applyAgentLamp(status) {
    lastStatus = status || null;
    var btn = document.getElementById('app-header-agent-btn');
    var lamp = document.getElementById('connection-indicator-agent');
    var timeEl = document.getElementById('app-header-agent-next');
    if (!btn || !lamp) return;
    var admin = isAppAdminUser();
    btn.hidden = !admin;
    if (!admin) return;
    var state = agentLampState(status);
    var time = formatAgentNextTime(status);
    lamp.className =
      'connection-indicator ' +
      lampClassForState(state) +
      (state === 'working' ? ' connection-indicator--busy' : '');
    var title = agentLampTitle(status, state);
    lamp.setAttribute('aria-label', title);
    btn.title = title;
    btn.setAttribute('aria-label', title);
    if (timeEl) timeEl.textContent = time;
  }

  function fetchAgentStatus() {
    if (!isAppAdminUser()) {
      applyAgentLamp(null);
      return Promise.resolve(null);
    }
    var api = global.CattleTrackerApi;
    if (!api || typeof api.getAgentStatus !== 'function') {
      applyAgentLamp(null);
      return Promise.resolve(null);
    }
    return api
      .getAgentStatus()
      .then(function (data) {
        applyAgentLamp(data);
        return data;
      })
      .catch(function () {
        applyAgentLamp(lastStatus);
        return lastStatus;
      });
  }

  function stopAgentStatusPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startAgentStatusPoll() {
    stopAgentStatusPoll();
    applyAgentLamp(lastStatus);
    if (!isAppAdminUser()) return;
    fetchAgentStatus();
    pollTimer = setInterval(fetchAgentStatus, POLL_MS);
  }

  function openAgentPendingModal() {
    var ver = '';
    try {
      var header = document.getElementById('app-version-header');
      if (header && header.textContent) ver = String(header.textContent).replace(/^v/i, '').trim();
    } catch (e) {}
    if (typeof global.showImprovementSuggestionModal === 'function') {
      global.showImprovementSuggestionModal(ver);
    }
  }

  function bindAgentLampClick() {
    var btn = document.getElementById('app-header-agent-btn');
    if (!btn || btn.dataset.agentBound === '1') return;
    btn.dataset.agentBound = '1';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openAgentPendingModal();
    });
  }

  function syncAgentStatusLamp() {
    bindAgentLampClick();
    startAgentStatusPoll();
  }

  global.syncAgentStatusLamp = syncAgentStatusLamp;
  global.fetchAgentStatus = fetchAgentStatus;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        bindAgentLampClick();
      });
    } else {
      bindAgentLampClick();
    }
  }
})(typeof window !== 'undefined' ? window : this);

export {};
