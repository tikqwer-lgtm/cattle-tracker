/**
 * Chat consultant route: POST /api/chat
 * Proxies to DeepSeek with app documentation as system context.
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

router.post('/chat', (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(503).json({ error: 'Чат-консультант не настроен' });
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

  fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey.trim()
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: fullMessages,
      max_tokens: 2048
    }),
    signal: controller.signal
  })
    .then((r) => {
      clearTimeout(timeoutId);
      if (!r.ok) {
        return r.json().then((data) => {
          const msg = (data && (data.error && data.error.message)) ? data.error.message : ('Ошибка ' + r.status);
          throw new Error(msg);
        }).catch(() => {
          throw new Error('Ошибка ' + r.status);
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
      console.error('chat DeepSeek error:', err);
      res.status(500).json({ error: err.message || 'Ошибка запроса к консультанту' });
    });
});

module.exports = router;
