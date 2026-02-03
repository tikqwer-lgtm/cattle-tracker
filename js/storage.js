// storage.js — работа с localStorage

let entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];

/**
 * Сохраняет записи в localStorage
 */
function saveLocally() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.js:8',message:'saveLocally called',data:{entriesCount:entries?.length,entriesSample:entries?.slice(0,2)?.map(e=>({cattleId:e.cattleId,inseminationDate:e.inseminationDate}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const jsonData = JSON.stringify(entries);
    localStorage.setItem('cattleEntries', jsonData);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.js:13',message:'saveLocally completed',data:{jsonLength:jsonData.length,storedLength:localStorage.getItem('cattleEntries')?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/86c9a476-9b52-4c72-882a-524ec24c8a0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.js:17',message:'saveLocally error',data:{error:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Ошибка сохранения в localStorage:', error);
    throw error;
  }
}

/**
 * Загружает записи из localStorage при запуске
 */
function loadLocally() {
  entries = JSON.parse(localStorage.getItem('cattleEntries')) || [];
  console.log("Загружено из localStorage:", entries.length, "записей");
  
  // Вызываем updateList если она существует
  if (typeof updateList === 'function') {
    updateList();
  }
}


/**
 * Возвращает новую запись коровы с полями по умолчанию
 * @returns {Object}
 */
function getDefaultCowEntry() {
  return {
    cattleId: '',
    nickname: '',
    birthDate: '',
    lactation: 1,
    calvingDate: '',
    inseminationDate: '',
    attemptNumber: 1,
    bull: '',
    inseminator: '',
    code: '',
    status: 'Охота',
    exitDate: '',
    dryStartDate: '',
    vwp: 60,
    note: '',
    protocol: {
      name: '',
      startDate: ''
    },
    dateAdded: nowFormatted(),
    synced: false
  };
}

// Экспорт функций
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    entries,
    saveLocally,
    loadLocally,
    getDefaultCowEntry
  };
}