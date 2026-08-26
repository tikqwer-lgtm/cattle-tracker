/**
 * Иерархия экранов для кнопки «Назад» (родитель, не история сессии).
 */

var SCREEN_PARENT = {
  'list-uzi': { screen: 'lists' },
  'list-insemination': { screen: 'lists' },
  'list-calving': { screen: 'lists' },
  tasks: { screen: 'lists' },
  lists: { screen: 'submenu', group: 'data' },
  events: { screen: 'submenu', group: 'data' },
  add: { screen: 'submenu', group: 'data' },
  view: { screen: 'submenu', group: 'data' },
  'stall-map': { screen: 'submenu', group: 'data' },
  'stall-inventory': { screen: 'submenu', group: 'data' },
  'all-inseminations': { screen: 'submenu', group: 'data' },
  submenu: { screen: 'herd-hub' },
  'herd-hub': { screen: 'menu' },
  'farm-card': { screen: 'menu' },
  notifications: { screen: 'herd-hub' },
  analytics: { screen: 'submenu', group: 'analytics' },
  'interval-analysis': { screen: 'submenu', group: 'analytics' },
  reproduction: { screen: 'submenu', group: 'analytics' },
  sync: { screen: 'submenu', group: 'settings' },
  'farm-settings': { screen: 'submenu', group: 'settings' },
  protocols: { screen: 'farm-settings' },
  help: { screen: 'submenu', group: 'settings' },
  admin: { screen: 'menu' },
  insemination: { screen: 'submenu', group: 'actions' },
  dry: { screen: 'submenu', group: 'actions' },
  calving: { screen: 'submenu', group: 'actions' },
  abort: { screen: 'submenu', group: 'actions' },
  uzi: { screen: 'submenu', group: 'actions' },
  'protocol-assign': { screen: 'submenu', group: 'actions' }
};

function resolveScreenParent(screenId, submenuGroup) {
  if (!screenId || screenId === 'menu' || screenId === 'auth') return null;
  if (screenId === 'view-cow') return { type: 'viewCowBack' };
  if (screenId === 'submenu' && submenuGroup === 'settings') return { screen: 'menu' };
  return SCREEN_PARENT[screenId] || { screen: 'menu' };
}

export { SCREEN_PARENT, resolveScreenParent };
