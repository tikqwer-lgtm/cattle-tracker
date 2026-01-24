// voice.js — Голосовой помощник "Гена" с подтверждением, очисткой и отменой

class VoiceAssistant {
  constructor() {
    this.isListening = false;        // Ждём "Гена"
    this.isRecording = false;        // После "Гена" — режим записи
    this.temporaryEntry = {};        // Временные данные
    this.audioContext = null;
    this.status = document.getElementById('status');

    this.init();
  }

  init() {
    if (!this.isSpeechSupported()) return;

    this.setupAudio();
    this.setupSpeechRecognition();
    this.bindEvents();
  }

  isSpeechSupported() {
    this.recognitionAvailable =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    if (!this.recognitionAvailable) {
      console.warn('🎤 Распознавание: не поддерживается');
      this.updateStatus('⚠️ Требуется Chrome');
      return false;
    }

    if (!'speechSynthesis' in window) {
      console.warn('📢 Синтез: не поддерживается');
    }

    return true;
  }

  setupAudio() {
    document.body.addEventListener('click', () => this.initAudio(), { once: true });
    document.body.addEventListener('touchstart', () => this.initAudio(), { once: true });
  }

  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, dur = 200, vol = 0.1) {
    if (!this.audioContext) return;
    const o = this.audioContext.createOscillator();
    const g = this.audioContext.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(this.audioContext.destination);
    o.start();
    setTimeout(() => o.stop(), dur);
  }

  speak(text) {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ru-RU';
      utter.rate = 1;
      utter.pitch = 1;
      speechSynthesis.speak(utter);
    }
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ru-RU';
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.start();
    console.log('🎤 Гена запущен. Скажите: "Гена"');
  }

  bindEvents() {
    this.recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      const lower = transcript.toLowerCase();
      console.log('🎙 Распознано:', transcript);

      if (!this.isRecording) {
        if (lower.includes('гена')) {
          this.isRecording = true;
          this.temporaryEntry = {};
          console.log('✅ Гена активирован. Слушаю данные...');
          this.speak('Слушаю');
          this.playTone(800, 200);
          this.updateStatus('🎙 Гена: Слушаю…');
        }
      } else {
        // Новые команды
        if (lower.includes('запиши')) {
          this.finalizeEntry();
          return;
        }

        if (lower.includes('что записано') || lower.includes('что собрал')) {
          this.confirmEntry();
          return;
        }

        if (lower.includes('очистить') || lower.includes('сбросить')) {
          this.clearEntry();
          return;
        }

        if (lower.includes('отмена') || lower.includes('стоп') || lower.includes('выход')) {
          this.cancelEntry();
          return;
        }

        // Обычные данные
        this.parseAndStore(transcript);
      }
    };

    this.recognition.onerror = (e) => {
      console.error('❌ Ошибка:', e.error);
      if (e.error === 'not-allowed') {
        this.updateStatus('🔴 Разрешите микрофон');
      }
      setTimeout(() => this.restart(), 2000);
    };

    this.recognition.onend = () => {
      setTimeout(() => this.restart(), 1000);
    };
  }

  parseAndStore(command) {
    const lower = command.toLowerCase();

    const cattle = lower.match(/(?:корова|номер)\s+(\d+)/i);
    if (cattle) {
      this.temporaryEntry.cattleId = cattle[1];
      this.playTone(700, 100);
    }

    const date = lower.match(/(\d{1,2})[^\w]*(январ[яь]|феврал[яь]|март[а]?|апрел[яь]|май[я]?|июн[яь]?|июл[яь]?|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])/i);
    if (date) {
      const day = date[1].padStart(2, '0');
      const monthNames = {
        'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
        'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
        'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
      };
      const month = monthNames[date[2].toLowerCase()];
      const year = (command.match(/20\d{2}/) || [new Date().getFullYear()])[0];
      this.temporaryEntry.date = `${year}-${month}-${day}`;
      this.playTone(700, 100);
    }

    const bull = lower.match(/бык\s+([^\s,]+)/i);
    if (bull) {
      this.temporaryEntry.bull = bull[1];
      this.playTone(700, 100);
    }

    const attempt = lower.match(/попытка\s+(\d+)/i);
    if (attempt) {
      this.temporaryEntry.attempt = attempt[1];
      this.playTone(700, 100);
    }

    if (lower.includes('пг') && lower.includes('шесть') && (lower.includes('же') || lower.includes('джи'))) {
      this.temporaryEntry.synchronization = 'PG6-G';
      this.playTone(700, 100);
    } else if (lower.includes('овсинх') || lower.includes('ов-синх')) {
      this.temporaryEntry.synchronization = 'Ovsynch';
      this.playTone(700, 100);
    } else if (lower.includes('косинх') || lower.includes('ко-синх')) {
      this.temporaryEntry.synchronization = 'Cosynch';
      this.playTone(700, 100);
    } else if (lower.includes('другое')) {
      this.temporaryEntry.synchronization = 'Другое';
      this.playTone(700, 100);
    }

    const note = lower.match(/примечание\s+(.+)/i) || lower.match(/заметка\s+(.+)/i);
    if (note) {
      this.temporaryEntry.note = note[1];
      this.playTone(700, 100);
    }
  }

  confirmEntry() {
    let text = 'Записано: ';
    const parts = [];

    if (this.temporaryEntry.cattleId) parts.push(`корова ${this.temporaryEntry.cattleId}`);
    if (this.temporaryEntry.date) parts.push(`дата ${this.formatDateForSpeech(this.temporaryEntry.date)}`);
    if (this.temporaryEntry.bull) parts.push(`бык ${this.temporaryEntry.bull}`);
    if (this.temporaryEntry.attempt) parts.push(`попытка ${this.temporaryEntry.attempt}`);
    if (this.temporaryEntry.synchronization) parts.push(`синх ${this.temporaryEntry.synchronization}`);
    if (this.temporaryEntry.note) parts.push(`примечание ${this.temporaryEntry.note}`);

    if (parts.length === 0) {
      text = 'Ничего не записано';
    } else {
      text += parts.join(', ');
    }

    console.log('📢 Подтверждение:', text);
    this.speak(text);
    this.updateStatus('📢: ' + text);
  }

  clearEntry() {
    this.temporaryEntry = {};
    this.speak('Очищено');
    this.playTone(500, 300);
    this.updateStatus('🧹 Очищено');
  }

  cancelEntry() {
    this.isRecording = false;
    this.temporaryEntry = {};
    this.speak('Отменено');
    this.playTone(400, 300);
    this.updateStatus('🛑 Отменено');
    console.log('🛑 Режим отменён');
  }

  finalizeEntry() {
    if (!this.temporaryEntry.cattleId || !this.temporaryEntry.date) {
      const missing = !this.temporaryEntry.cattleId ? 'номер коровы' : 'дата';
      const msg = `Не хватает: ${missing}`;
      this.speak(msg);
      this.updateStatus('❌ ' + msg);
      this.playTone(400, 300);
      return;
    }

    if (window.addEntryFromVoice) {
      window.addEntryFromVoice(this.temporaryEntry);
    }

    this.speak('Записано');
    this.playTone(400, 200);
    this.updateStatus('✅ Записано');
    console.log('✅ Запись добавлена:', this.temporaryEntry);

    // Сброс
    this.isRecording = false;
    this.temporaryEntry = {};
  }

  formatDateForSpeech(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  restart() {
    if (this.recognition) {
      this.recognition.start();
    }
  }

  updateStatus(text) {
    if (this.status) {
      const old = this.status.textContent;
      this.status.textContent = text;
      setTimeout(() => {
        if (this.status.textContent === text) {
          this.status.textContent = old;
        }
      }, 4000);
    }
  }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
  new VoiceAssistant();
});
