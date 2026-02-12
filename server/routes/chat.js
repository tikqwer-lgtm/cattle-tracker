/**
 * Chat consultant route: POST /api/chat
 * Supports: 1) Ollama (local, free) via OLLAMA_URL  2) DeepSeek (cloud) via DEEPSEEK_API_KEY
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_HISTORY_MESSAGES = 20;
const REQUEST_TIMEOUT_MS = 30000;

const rootDir = path.join(__dirname, '..', '..');
const docFiles = [
  'README.md',
  'ИНСТРУКЦИЯ_РАБОТА_С_ДАННЫМИ.md',
  'MULTIPLATFORM.md'
];

let systemPromptCache = null;

function loadDocsContext() {
  if (systemPromptCache !== null) return systemPromptCache;
  const parts = [];
  for (const name of docFiles) {
    const filePath = path.join(rootDir, name);
    try {
      if (fs.existsSync(filePath)) {
        const text = fs.readFileSync(filePath, 'utf8');
        parts.push('--- ' + name + ' ---\n' + text);
      }
    } catch (e) {
      console.warn('chat: could not read', name, e.message);
    }
  }
  const docsText = parts.length ? parts.join('\n\n') : 'Документация недоступна.';
  systemPromptCache =
    'Ты консультант по программе «Учёт коров» — веб-приложению для учёта коров на ферме (осеменение, отёл, аналитика, уведомления). ' +
    'Отвечай только на вопросы по работе приложения. Не запрашивай и не обрабатывай персональные данные пользователей или данные стада. ' +
    'Опирайся на следующую документацию:\n\n' + docsText;
  return systemPromptCache;
}

function getChatBackend() {
  const ollamaUrl = (process.env.OLLAMA_URL || '').trim();
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl.replace(/\/$/, ''), model: (process.env.OLLAMA_MODEL || 'llama3.2').trim() };
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  if (apiKey) return { type: 'deepseek', apiKey };
  return null;
}

function sendToBackend(backend, fullMessages, controller) {
  if (backend.type === 'ollama') {
    const url = backend.url + '/v1/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: backend.model,
        messages: fullMessages,
        max_tokens: 2048
      }),
      signal: controller.signal
    });
  }
  return fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + backend.apiKey
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: fullMessages,
      max_tokens: 2048
    }),
    signal: controller.signal
  });
}

router.post('/chat', (req, res) => {
  const backend = getChatBackend();
  if (!backend) {
    return res.status(503).json({
      error: 'Чат не настроен. Задайте OLLAMA_URL (например http://localhost:11434) для бесплатной локальной модели или DEEPSEEK_API_KEY для облака.'
    });
  }

  const body = req.body || {};
  let messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length > MAX_HISTORY_MESSAGES) {
    messages = messages.slice(-MAX_HISTORY_MESSAGES);
  }

  const systemContent = loadDocsContext();
  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  sendToBackend(backend, fullMessages, controller)
    .then((r) => {
      clearTimeout(timeoutId);
      if (!r.ok) {
        const status = r.status;
        return r.json().then((data) => {
          const msg = (data && data.error && data.error.message) ? data.error.message : ('Ошибка ' + status);
          const err = new Error(msg);
          err.status = status;
          throw err;
        }).catch((e) => {
          if (e.status) throw e;
          const err = new Error('Ошибка ' + status);
          err.status = status;
          throw err;
        });
      }
      return r.json();
    })
    .then((data) => {
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      res.json({ content: typeof content === 'string' ? content : '' });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Превышено время ожидания ответа' });
      }
      if (err.status === 402) {
        return res.status(402).json({
          error: 'Недостаточно средств на счёте DeepSeek. Используйте бесплатный Ollama: установите с https://ollama.com и в server/.env задайте OLLAMA_URL=http://localhost:11434'
        });
      }
      if (backend.type === 'ollama') {
        const hint = ' Запущен ли Ollama (ollama serve)? Загружена ли модель (ollama run ' + backend.model + ')?';
        return res.status(500).json({ error: (err.message || 'Ошибка Ollama') + hint });
      }
      console.error('chat backend error:', err);
      res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({
        error: err.message || 'Ошибка запроса к консультанту'
      });
    });
});

module.exports = router;
