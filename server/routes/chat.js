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
const REQUEST_TIMEOUT_MS = parseInt(process.env.CHAT_REQUEST_TIMEOUT_MS || '120000', 10);
const OLLAMA_MAX_TOKENS = parseInt(process.env.CHAT_OLLAMA_MAX_TOKENS || '512', 10);
const DEEPSEEK_MAX_TOKENS = parseInt(process.env.CHAT_DEEPSEEK_MAX_TOKENS || '2048', 10);
const CHAT_DOCS_MAX_CHARS = parseInt(process.env.CHAT_DOCS_MAX_CHARS || '8000', 10);
const CHAT_TEMPERATURE = parseFloat(process.env.CHAT_TEMPERATURE || '0.2');

const rootDir = path.join(__dirname, '..', '..');
const serverDocsDir = path.join(__dirname, '..', 'docs');
/** Всегда целиком в контекст (меню, навигация) — не обрезается */
const priorityDocFiles = [{ dir: serverDocsDir, name: 'CHAT_СПРАВКА.md' }];
const docFiles = [
  'README.md',
  'ДОКУМЕНТАЦИЯ.md',
  'ИНСТРУКЦИЯ_РАБОТА_С_ДАННЫМИ.md',
  'MULTIPLATFORM.md'
];

let systemPromptCacheFull = null;
let systemPromptCacheCompact = null;
let systemPromptCacheGreeting = null;

function isGreetingOnly(text) {
  const t = String(text || '').trim();
  return /^(привет|здравствуй|здравствуйте|добрый|доброе|hi|hello|hey)[\s!?.…,]*$/i.test(t);
}

function isCompactChat(messages) {
  const users = (messages || []).filter((m) => m.role === 'user');
  const last = users[users.length - 1];
  if (!last) return true;
  const t = String(last.content || '').trim();
  if (!t) return true;
  if (t.length <= 80 && users.length <= 2) {
    if (/^(привет|здравствуй|здравствуйте|добрый|доброе|hi|hello|hey|спасибо|пока|да|нет)[\s!?.…,]*$/i.test(t)) {
      return true;
    }
  }
  if (users.length === 1 && t.length < 50) return true;
  return false;
}

function readDocFile(name, baseDir) {
  const filePath = path.join(baseDir || rootDir, name);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e) {
    console.warn('chat: could not read', name, e.message);
  }
  return '';
}

function loadPriorityDocsBlock() {
  const parts = [];
  for (const item of priorityDocFiles) {
    const name = typeof item === 'string' ? item : item.name;
    const dir = typeof item === 'string' ? rootDir : item.dir;
    const text = readDocFile(name, dir);
    if (text) parts.push('--- ' + name + ' ---\n' + text);
  }
  return parts.join('\n\n');
}

function loadDataContextPrompt(dataContext) {
  const block = String(dataContext || '').trim();
  if (!block) return '';
  return (
    'Ты консультант по программе «Учёт коров». Пиши только на русском, кратко (2–5 предложений). ' +
    'Ниже — актуальные данные стада из программы пользователя (уже посчитаны). ' +
    'Отвечай на вопрос, опираясь ТОЛЬКО на эти цифры и списки. Не меняй числа, не выдумывай животных. ' +
    'Если данных недостаточно — скажи об этом.\n\n' +
    block
  );
}

function loadDocsContext(mode) {
  if (mode === 'data') {
    return '';
  }
  if (mode === 'greeting') {
    if (systemPromptCacheGreeting !== null) return systemPromptCacheGreeting;
    systemPromptCacheGreeting =
      'Ты консультант по программе «Учёт коров» для учёта коров на ферме. ' +
      'Ответь на приветствие одним-двумя короткими предложениями только на русском: поприветствуй и предложи помощь с вопросами по программе.';
    return systemPromptCacheGreeting;
  }
  const compact = mode === 'compact';
  if (compact) {
    if (systemPromptCacheCompact !== null) return systemPromptCacheCompact;
    const priorityBlock = loadPriorityDocsBlock();
    systemPromptCacheCompact =
      'Ты консультант по программе «Учёт коров». Пиши только на русском. ' +
      'На приветствие ответь одним-двумя предложениями: кто ты и чем можешь помочь. ' +
      'На вопросы по программе отвечай кратко по справке ниже.\n\n' +
      (priorityBlock || 'Документация недоступна.');
    return systemPromptCacheCompact;
  }
  if (systemPromptCacheFull !== null) return systemPromptCacheFull;
  const priorityBlock = loadPriorityDocsBlock();
  let budget = Math.max(0, CHAT_DOCS_MAX_CHARS - priorityBlock.length);
  const extraParts = [];
  for (const name of docFiles) {
    if (budget <= 0) break;
    const text = readDocFile(name);
    if (!text) continue;
    const slice = text.length <= budget ? text : text.slice(0, budget) + '\n\n[... фрагмент обрезан ...]';
    extraParts.push('--- ' + name + ' ---\n' + slice);
    budget -= slice.length;
  }
  const docsText = [priorityBlock, extraParts.join('\n\n')].filter(Boolean).join('\n\n') || 'Документация недоступна.';
  systemPromptCacheFull =
    'Ты консультант по программе «Учёт коров» — приложению для учёта коров на ферме. ' +
    'Отвечай только на вопросы по работе программы (меню, экраны, синхронизация, ввод данных). ' +
    'Пиши только на русском языке, без английских вставок и иероглифов. Ответы краткие и по делу (2–6 предложений). ' +
    'Опирайся на документацию ниже. Если ответа нет в документации — скажи об этом и предложи раздел «Справка» или администратора. ' +
    'Не выдумывай функции, которых нет в тексте. Не запрашивай персональные данные и данные стада.\n\n' +
    docsText;
  return systemPromptCacheFull;
}

function getChatBackend() {
  const ollamaUrl = (process.env.OLLAMA_URL || '').trim();
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl.replace(/\/$/, ''), model: (process.env.OLLAMA_MODEL || 'llama3.2').trim() };
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  if (apiKey) return { type: 'deepseek', apiKey };
  return null;
}

function sendToBackend(backend, fullMessages, controller, opts) {
  opts = opts || {};
  const maxTokens = opts.maxTokens != null ? opts.maxTokens : OLLAMA_MAX_TOKENS;
  if (backend.type === 'ollama') {
    const url = backend.url + '/v1/chat/completions';
    const body = {
      model: backend.model,
      messages: fullMessages,
      max_tokens: maxTokens,
      temperature: CHAT_TEMPERATURE
    };
    if (opts.compact) {
      body.options = { num_ctx: 4096, num_predict: maxTokens };
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      max_tokens: opts.compact ? Math.min(256, maxTokens) : DEEPSEEK_MAX_TOKENS,
      temperature: CHAT_TEMPERATURE
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

  const dataContext = typeof body.dataContext === 'string' ? body.dataContext.trim() : '';
  const users = messages.filter((m) => m.role === 'user');
  const lastUser = users[users.length - 1];
  const hasDataContext = dataContext.length > 0;
  const greetingOnly = !hasDataContext && lastUser && isGreetingOnly(lastUser.content);
  const compact = !hasDataContext && !greetingOnly && isCompactChat(messages);
  const promptMode = hasDataContext ? 'data' : (greetingOnly ? 'greeting' : (compact ? 'compact' : 'full'));
  const systemContent = hasDataContext
    ? loadDataContextPrompt(dataContext)
    : loadDocsContext(promptMode);
  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const maxTokens = hasDataContext
    ? parseInt(process.env.CHAT_OLLAMA_MAX_TOKENS_DATA || '256', 10)
    : (greetingOnly
      ? parseInt(process.env.CHAT_OLLAMA_MAX_TOKENS_GREETING || '64', 10)
      : (compact
        ? parseInt(process.env.CHAT_OLLAMA_MAX_TOKENS_SHORT || '128', 10)
        : OLLAMA_MAX_TOKENS));

  sendToBackend(backend, fullMessages, controller, { compact: hasDataContext || greetingOnly || compact, maxTokens: maxTokens })
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
