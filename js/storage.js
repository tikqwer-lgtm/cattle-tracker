// storage.js — работа с localStorage и расширенной моделью коровы

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  localStorage.setItem('cattleEntries', JSON.stringify(entries));
}

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];
  console.log("Загружено из localStorage:", entries);
  updateList();
}

/**
 * Возвращает пустую запись с полями по умолчанию
 */
function getDefaultCowEntry() {
  return {
    cattleId: '',
    nickname: '',
    birthDate: '',
    lactation: 1, // по умолчанию 1
    calvingDate: '', // дата отёла
    lactationDay: 0, // вычисляется
    inseminationDate: '',
    attemptNumber: 1,
    bull: '',
    inseminator: '',
    code: '', // Охота, РеСИНХ и т.д.
    status: 'Охота',
    protocol: {
      name: '',
      startDate: '',
      daysInProtocol: 0,
      duration: 0
    },
    exitDate: '',
    dryStartDate: '', // дата запуска
    dryDays: 0, // вычисляется
    ageAtFirstCalving: 0, // вычисляется
    servicePeriod: 0, // с/п от отёла до плодотворного осеменения
    calvingInterval: 0, // межотёльный период
    vwp: 60, // ПДО по умолчанию 60 дней
    pr: 0, // процент оплодотворённости
    cr: 0, // процент стельности
    hdr: 0, // индекс оплодотворения
    synced: false,
    dateAdded: nowFormatted()
  };
}
