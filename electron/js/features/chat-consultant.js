/**
 * chat-consultant.js — панель чат-консультанта и контекстное меню (ПКМ).
 */
(function (global) {
  'use strict';

  var chatHistory = [];
  var chatInFlight = false;

  function getBaseUrl() {
    if (global.CattleTrackerApi && typeof global.CattleTrackerApi.getBaseUrl === 'function') {
      var fromApi = (global.CattleTrackerApi.getBaseUrl() || '').trim().replace(/\/$/, '');
      if (fromApi) return fromApi;
    }
    var b = (global.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
    if (b) return b;
    try {
      b = (localStorage.getItem('cattleTracker_apiBase') || '').trim().replace(/\/$/, '');
    } catch (e) {}
    return b || '';
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

  function getSendBtn() {
    return document.querySelector('.chat-consultant-send');
  }

  function appendMessage(role, content, isError) {
    var container = getMessagesContainer();
    if (!container) return null;
    var div = document.createElement('div');
    div.className = 'chat-consultant-msg ' + (role === 'user' ? 'user' : (isError ? 'error' : (role === 'typing' ? 'typing' : 'assistant')));
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function removeTypingIndicator() {
    var el = document.getElementById('chat-consultant-typing');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showTypingIndicator() {
    removeTypingIndicator();
    var container = getMessagesContainer();
    if (!container) return;
    var div = document.createElement('div');
    div.id = 'chat-consultant-typing';
    div.className = 'chat-consultant-msg typing';
    div.setAttribute('aria-live', 'polite');
    div.textContent = 'Думаю…';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hasUnansweredUserMessage() {
    if (!chatHistory.length) return false;
    return chatHistory[chatHistory.length - 1].role === 'user';
  }

  function updateSendButtonState() {
    var sendBtn = getSendBtn();
    var input = getInput();
    if (!sendBtn) return;
    var hasText = input && (input.value || '').trim().length > 0;
    sendBtn.disabled = !hasText;
    if (chatInFlight) {
      sendBtn.textContent = 'В очереди…';
    } else {
      sendBtn.textContent = 'Отправить';
    }
  }

  function processChatQueue() {
    if (chatInFlight || !hasUnansweredUserMessage()) return;

    var base = getBaseUrl();
    if (!base) return;

    chatInFlight = true;
    showTypingIndicator();
    updateSendButtonState();

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
        removeTypingIndicator();
        appendMessage('assistant', content);
      })
      .catch(function (err) {
        var isNetwork = !err || err.name === 'TypeError' || (err.message && (err.message.indexOf('fetch') !== -1 || err.message.indexOf('Network') !== -1));
        var msg = isNetwork
          ? 'Нет подключения к интернету. Чат-консультант работает через сервер и требует сеть.'
          : (err && err.message ? err.message : 'Ошибка соединения');
        removeTypingIndicator();
        appendMessage('assistant', msg, true);
      })
      .then(function () {
        chatInFlight = false;
        updateSendButtonState();
        processChatQueue();
      });
  }

  function openChatConsultant() {
    var panel = getPanel();
    if (!panel) return;
    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    var input = getInput();
    if (input) {
      input.disabled = false;
      input.readOnly = false;
      setTimeout(function () {
        input.focus();
        updateSendButtonState();
      }, 50);
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      var container = getMessagesContainer();
      if (container && container.children.length === 0) {
        appendMessage('assistant', 'Чат-консультант работает только при подключении к интернету. Сейчас сеть недоступна — дождитесь появления подключения.', true);
      }
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
    updateSendButtonState();
    processChatQueue();
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
    input.addEventListener('input', updateSendButtonState);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    updateSendButtonState();
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
