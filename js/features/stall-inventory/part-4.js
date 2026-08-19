/** __stallInv part 4 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallInv'] = root['__stallInv'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function invRenderActiveTab() {
  var host = document.getElementById('stallInventoryContent');
  if (!host) return;
  globalThis['__stallInv'].invStopAssignPoll();

  document.querySelectorAll('.stall-inventory-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === globalThis['__stallInv'].state._inventoryTab);
  });

  if (globalThis['__stallInv'].state._inventoryTab === 'print') globalThis['__stallInv'].invRenderPrintTab(host);
  else if (globalThis['__stallInv'].state._inventoryTab === 'check') globalThis['__stallInv'].invRenderCheckTab(host);
  else globalThis['__stallInv'].invRenderResultTab(host);
}

function initStallInventoryScreen() {
  NS.state._inventoryLayout = globalThis['__stallInv'].invReadLayout();
  if (!globalThis['__stallInv'].state._inventorySession) {
    var saved = globalThis['__stallInv'].invLoadSession();
    if (saved && saved.objectId === globalThis['__stallInv'].invGetObjectId()) {
      globalThis['__stallInv'].state._inventorySession = saved;
      globalThis['__stallInv'].invPrepareYardCells();
      if (saved.phase === 'done') globalThis['__stallInv'].state._inventoryTab = 'result';
      else if (saved.phase) globalThis['__stallInv'].state._inventoryTab = 'check';
    }
  }

  document.querySelectorAll('.stall-inventory-tab').forEach(function (btn) {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      globalThis['__stallInv'].state._inventoryTab = btn.getAttribute('data-tab') || 'print';
      invRenderActiveTab();
    });
  });

  invRenderActiveTab();
}


  // register functions
  NS.invRenderActiveTab = invRenderActiveTab;
  NS.initStallInventoryScreen = initStallInventoryScreen;
})();
export {};
