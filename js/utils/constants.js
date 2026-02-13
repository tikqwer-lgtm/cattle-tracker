/**
 * constants.js — единое место для ключей localStorage, лимитов и префиксов API.
 * Модули могут использовать эти константы или свои локальные переменные.
 */
var CATTLE_TRACKER_PREFIX = 'cattleTracker_';

var STORAGE_KEYS = {
  apiBase: CATTLE_TRACKER_PREFIX + 'apiBase',
  apiToken: CATTLE_TRACKER_PREFIX + 'apiToken',
  users: CATTLE_TRACKER_PREFIX + 'users',
  currentUser: CATTLE_TRACKER_PREFIX + 'currentUser',
  currentObject: CATTLE_TRACKER_PREFIX + 'currentObject',
  objects: CATTLE_TRACKER_PREFIX + 'objects',
  notificationsOpen: CATTLE_TRACKER_PREFIX + 'notifications_open',
  hasSeenHints: CATTLE_TRACKER_PREFIX + 'hasSeenHints',
  exportSelectedFields: CATTLE_TRACKER_PREFIX + 'export_selectedFields',
  exportFieldTemplates: CATTLE_TRACKER_PREFIX + 'export_fieldTemplates',
  viewListVisibleFields: CATTLE_TRACKER_PREFIX + 'viewList_visibleFields',
  viewListFieldTemplates: CATTLE_TRACKER_PREFIX + 'viewList_fieldTemplates',
  analyticsSettings: CATTLE_TRACKER_PREFIX + 'analytics_settings',
  searchFilter: CATTLE_TRACKER_PREFIX + 'search_filter',
  notificationHistory: CATTLE_TRACKER_PREFIX + 'notification_history',
  notifications: CATTLE_TRACKER_PREFIX + 'notifications',
  protocols: CATTLE_TRACKER_PREFIX + 'protocols',
  backupPrefix: CATTLE_TRACKER_PREFIX + 'backup_'
};

var LIMITS = {
  maxBackups: 10,
  notificationHistoryMax: 200
};
