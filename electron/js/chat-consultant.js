/**
 * chat-consultant.js — панель чат-консультанта и контекстное меню (ПКМ).
 */
(function (global) {
  'use strict';

  var chatHistory = [];

  function getBaseUrl() {
    return (global.CATTLE_TRACKER_API_BASE || '').replace(/\/$/, '');
  }

  function getToken() {
    try {
      return localStorage.getItem('cattleTracker_apiToken');
    } catch (e) {
      return null;
    }
  }

  function getMessagesContainer() {
    return document.getElementById('chat-consultant-messages');
  }

  function getPanel() {
    return document.getElementById('chat-consultant-panel');
  }

  function getInput() {
    return document.getElementById('chat-consultant-input');
  }

  function appendMessage(role, content, isError) {
    var container = getMessagesContainer();
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'chat-consultant-msg ' + (role === 'user' ? 'user' : (isError ? 'error' : 'assistant'));
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function openChatConsultant() {
    var panel = getPanel();
    if (!panel) return;
    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    var input = getInput();
    if (input) {
      input.focus();
    }
  }

  function closeChatConsultant() {
    var panel = getPanel();
    if (!panel) return;
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
  }

  function sendChatMessage() {
    var input = getInput();
    if (!input) return;
    var text = (input.value || '').trim();
    if (!text) return;

    var base = getBaseUrl();
    if (!base) {
      if (typeof showToast === 'function') {
        showToast('Укажите адрес сервера в Настройках (Войти / Пользователи).', 'info', 5000);
      }
      return;
    }

    chatHistory.push({ role: 'user', content: text });
    appendMessage('user', text);
    input.value = '';

    var sendBtn = document.querySelector('.chat-consultant-send');
    if (sendBtn) sendBtn.disabled = true;

    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var messages = chatHistory.map(function (m) { return { role: m.role, content: m.content }; });

    fetch(base + '/api/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ messages: messages })
    })
      .then(function (res) {
        var isJson = (res.headers.get('Content-Type') || '').indexOf('application/json') !== -1;
        if (res.ok) return isJson ? res.json() : { content: '' };
        return isJson ? res.json().then(function (data) {
          throw new Error(data.error || data.message || 'Ошибка ' + res.status);
        }) : Promise.reject(new Error('Ошибка ' + res.status));
      })
      .then(function (data) {
        var content = (data && data.content) ? data.content : '';
        chatHistory.push({ role: 'assistant', content: content });
        appendMessage('assistant', content);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : 'Ошибка соединения';
        appendMessage('assistant', msg, true);
      })
      .then(function () {
        if (sendBtn) sendBtn.disabled = false;
      });
  }

  function contextMenuOpenConsultant() {
    hideContextMenu();
    openChatConsultant();
  }

  function getContextMenu() {
    return document.getElementById('chat-context-menu');
  }

  function showContextMenu(x, y) {
    var menu = getContextMenu();
    if (!menu) return;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.removeAttribute('hidden');
    menu.setAttribute('aria-hidden', 'false');
  }

  function hideContextMenu() {
    var menu = getContextMenu();
    if (!menu) return;
    menu.setAttribute('hidden', '');
    menu.setAttribute('aria-hidden', 'true');
  }

  function initContextMenu() {
    document.addEventListener('contextmenu', function (e) {
      var target = e.target;
      if (target && (target.closest('input') || target.closest('textarea') || target.closest('#chat-consultant-panel') || target.closest('#chat-context-menu'))) {
        return;
      }
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener('click', function () {
      hideContextMenu();
    });
  }

  function initInputSubmit() {
    var input = getInput();
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  global.openChatConsultant = openChatConsultant;
  global.closeChatConsultant = closeChatConsultant;
  global.sendChatMessage = sendChatMessage;
  global.contextMenuOpenConsultant = contextMenuOpenConsultant;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initContextMenu();
      initInputSubmit();
      if (global.electronAPI && global.electronAPI.onOpenChatConsultant) {
        global.electronAPI.onOpenChatConsultant(openChatConsultant);
      }
    });
  } else {
    initContextMenu();
    initInputSubmit();
    if (global.electronAPI && global.electronAPI.onOpenChatConsultant) {
      global.electronAPI.onOpenChatConsultant(openChatConsultant);
    }
  }
})(typeof window !== 'undefined' ? window : this);
