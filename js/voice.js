// js/voice.js — Голосовой ввод с активацией по слову "Гена" и звуками

/**
 * Модуль голосового ввода
 */
class VoiceInput {
  constructor() {
    this.isListening = false; // false = ждём "Гена", true = ждём команду
    this.audioContext = null;
    this.statusElement = document.getElementById('status');
    this.init();
  }

  init() {
    if (!this.isSupported()) return;

    this.setupAudio();
    this.setupSpeechRecognition();
    this.bindEvents();
  }

  isSupported() {
    this.isAvailable =
      'SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window;

    if (!this.isAvailable) {
      console.warn('🎤 Web Speech API не поддерживается');
      if (this.statusElement) {
        this.statusElement.textContent = '⚠️ Голос недоступен (Chrome/Edge)';
      }
    }

    return this.isAvailable;
  }

  setupAudio() {
    // Аудио-контекст создаётся при первом взаимодействии
    document.body.addEventListener('click', () => this.initAudio(), { once: true });
    document.body.addEventListener('touchstart', () => this.initAudio(), { once: true });
  }

  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, duration = 200, type = 'sine', vol = 0.1) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start();
    setTimeout(() => osc.stop(), duration);
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.lang = 'ru-RU';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.start();
    console.log('🎤 Готов. Жду "Гена"…');
  }

  bindEvents() {
    this.recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log('🎙 Получено:', transcript);

      if (!this.isListening) {
        if (transcript.includes('гена')) {
          this.isListening = true;
          console.log('✅ Активировано! Жду команду...');
          this.updateStatusTemp('🎙 Слушаю...', 3000);
          this.playTone(800, 200); // Высокий звук
        }
      } else {
        // Передаём команду в основное приложение
        if (window.parseVoiceCommand) {
          window.parseVoiceCommand(transcript);
        }
        this.isListening = false;
        console.log('🔁 Ожидание "Гена"…');
        this.updateStatusTemp('✅ Обработано', 2000);
        this.playTone(400, 200); // Низкий звук
      }
    };

    this.recognition.onerror = (event) => {
      console.error('❌ Ошибка:', event.error);
      if (event.error === 'not-allowed') {
        this.updateStatusTemp('🔴 Разрешите микрофон', 5000);
      }
      setTimeout(() => this.restart(), 2000);
    };

    this.recognition.onend = () => {
      setTimeout(() => this.restart(), 1000);
    };
  }

  restart() {
    if (this.recognition) {
      this.recognition.start();
    }
  }

  updateStatusTemp(message, delay) {
    if (!this.statusElement) return;
    const old = this.statusElement.textContent;
    this.statusElement.textContent = message;
    setTimeout(() => {
      if (this.statusElement.textContent === message) {
        this.statusElement.textContent = old;
      }
    }, delay);
  }
}

// Запускаем при загрузке
document.addEventListener('DOMContentLoaded', () => {
  new VoiceInput();
});
