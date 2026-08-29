/**
 * Серверный inbox: уведомления о подключении к объекту.
 */
(function (global) {
  'use strict';

  function processServerInbox() {
    var api = global.CattleTrackerApi;
    if (!api || typeof api.getInbox !== 'function') return Promise.resolve();
    if (!global.CATTLE_TRACKER_USE_API) return Promise.resolve();
    return api
      .getInbox(true)
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) return;
        var chain = Promise.resolve();
        items.forEach(function (item) {
          chain = chain.then(function () {
            if (!item) return Promise.resolve();
            if (item.type === 'report_revision') {
              var text = (item.payload && item.payload.message) || '';
              if (text && typeof global.prependImprovementDraft === 'function') {
                global.prependImprovementDraft(text);
              }
              var revMsg = 'Предложение вернули на доработку. Откройте «Обновить» в шапке.';
              if (typeof global.showToast === 'function') global.showToast(revMsg, 'info', 8000);
              return api.markInboxRead(item.id);
            }
            if (item.type !== 'object_assigned') {
              return api.markInboxRead(item.id);
            }
            var name =
              (item.payload && (item.payload.objectName || item.payload.objectId)) ||
              'объекту';
            var msg = 'Вас подключили к объекту «' + name + '»';
            if (typeof global.createNotification === 'function') {
              global.createNotification(
                'info',
                msg,
                '',
                {
                  kind: 'object_assigned',
                  category: 'sync',
                  objectId: item.payload && item.payload.objectId,
                  dedupeKey: 'object_assigned_' + (item.payload && item.payload.objectId) + '_' + item.id
                },
                { showToast: true, showSystem: true }
              );
            } else if (typeof global.showToast === 'function') {
              global.showToast(msg, 'info', 8000);
            }
            return api.markInboxRead(item.id);
          });
        });
        return chain.then(function () {
          if (typeof global.loadObjectsFromApi === 'function') {
            return global.loadObjectsFromApi();
          }
        });
      })
      .catch(function () {});
  }

  global.processServerInbox = processServerInbox;
})(typeof window !== 'undefined' ? window : this);

export {};
