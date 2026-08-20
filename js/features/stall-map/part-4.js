/** __stallMap part 4 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__stallMap'] = root['__stallMap'] || {};
  var global = root;

function stallMapRedrawIfActive() {
  var scr = document.getElementById('stall-map-screen');
  if (!scr || !scr.classList.contains('active')) return;
  try {
    globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();
    globalThis['__stallMap'].stallMapRenderGrid();
  } catch (e) {
    console.warn('stallMapRedrawIfActive:', e);
  }
}

function stallMapBindLifecycleRefresh() {
  if (globalThis['__stallMap'].state._stallMapLifecycleBound) return;
  globalThis['__stallMap'].state._stallMapLifecycleBound = true;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    stallMapRedrawIfActive();
    if (typeof window.softRepaintCattleTrackerView === 'function') window.softRepaintCattleTrackerView();
  });
  window.addEventListener(
    'pageshow',
    function (ev) {
      if (ev.persisted) stallMapRedrawIfActive();
    },
    false
  );
  window.addEventListener('resize', function () {
    var scr = document.getElementById('stall-map-screen');
    if (!scr || !scr.classList.contains('active')) return;
    if (document.getElementById('stallMapAssignModal') && document.getElementById('stallMapAssignModal').classList.contains('active')) {
      globalThis['__stallMap'].stallMapApplyAssignModalInset();
    }
  });
}

function initStallMapScreen() {
  globalThis['__stallMap'].stallMapBindEntriesUpdatedListener();
  stallMapBindLifecycleRefresh();
  var objectId = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
  var yardSel = document.getElementById('stallMapYardSelect');
  var rowsInp = document.getElementById('stallMapRowsInput');
  var colsInp = document.getElementById('stallMapColsInput');
  var saveBtn = document.getElementById('stallMapSaveGridBtn');
  var deleteBtn = document.getElementById('stallMapDeleteYardBtn');
  var createBtn = document.getElementById('stallMapCreateYardBtn');
  var toolbar = document.getElementById('stallMapToolbar');
  var canEdit = typeof window.canEdit !== 'function' || window.canEdit();

  if (toolbar) {
    toolbar.querySelectorAll('input,button,select').forEach(function (el) {
      if (el.id === 'stallMapSaveGridBtn' || el.id === 'stallMapDeleteYardBtn') el.style.display = canEdit ? '' : 'none';
    });
    if (yardSel) yardSel.disabled = !canEdit;
    if (rowsInp) rowsInp.readOnly = !canEdit;
    if (colsInp) colsInp.readOnly = !canEdit;
  }
  if (createBtn) createBtn.style.display = canEdit ? '' : 'none';

  globalThis['__stallMap'].stallMapLoadLayout(objectId, function () {
    var has = globalThis['__stallMap'].stallMapLayoutHasYards();
    globalThis['__stallMap'].stallMapSetToolbarVisible(has);
    globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();
    if (has) {
      globalThis['__stallMap'].stallMapSyncToolbarInputs();
      globalThis['__stallMap'].stallMapRenderGrid();
    }
  });

  if (yardSel && !yardSel.dataset.bound) {
    yardSel.dataset.bound = '1';
    yardSel.addEventListener('change', function () {
      globalThis['__stallMap'].state._stallMapYardKey = yardSel.value;
      globalThis['__stallMap'].stallMapSyncToolbarInputs();
      globalThis['__stallMap'].stallMapRenderGrid();
    });
  }

  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = '1';
    createBtn.addEventListener('click', function () {
      if (!canEdit) return;
      globalThis['__stallMap'].stallMapOpenCreateYardModal();
    });
  }

  var createModal = document.getElementById('stallMapCreateYardModal');
  var createSubmit = document.getElementById('stallMapCreateYardSubmit');
  var createCancel = document.getElementById('stallMapCreateYardCancel');
  if (createSubmit && !createSubmit.dataset.bound) {
    createSubmit.dataset.bound = '1';
    createSubmit.addEventListener('click', function () {
      if (!canEdit) return;
      globalThis['__stallMap'].stallMapSubmitCreateYard();
    });
  }
  if (createCancel && !createCancel.dataset.bound) {
    createCancel.dataset.bound = '1';
    createCancel.addEventListener('click', function () {
      globalThis['__stallMap'].stallMapCloseCreateYardModal();
    });
  }
  if (createModal && !createModal.dataset.overlayBound) {
    createModal.dataset.overlayBound = '1';
    createModal.addEventListener('click', function (e) {
      if (e.target === createModal) globalThis['__stallMap'].stallMapCloseCreateYardModal();
    });
  }

  var createKeyInp = document.getElementById('stallMapCreateYardKeyInput');
  var createRowsInp = document.getElementById('stallMapCreateYardRowsInput');
  var createColsInp = document.getElementById('stallMapCreateYardColsInput');
  function stallMapCreateYardKeydown(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (canEdit) globalThis['__stallMap'].stallMapSubmitCreateYard();
    }
  }
  [createKeyInp, createRowsInp, createColsInp].forEach(function (el) {
    if (el && !el.dataset.enterBound) {
      el.dataset.enterBound = '1';
      el.addEventListener('keydown', stallMapCreateYardKeydown);
    }
  });

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', function () {
      globalThis['__stallMap'].stallMapSaveGridFromUI();
    });
  }

  if (deleteBtn && !deleteBtn.dataset.bound) {
    deleteBtn.dataset.bound = '1';
    deleteBtn.addEventListener('click', function () {
      if (!canEdit) return;
      var yk = globalThis['__stallMap'].stallMapGetCurrentYardKeyFromUI();
      globalThis['__stallMap'].stallMapDeleteYard(objectId, yk);
    });
  }

  var modal = document.getElementById('stallMapAssignModal');
  var inp = document.getElementById('stallMapAssignInput');
  var assignSaveBtn = document.getElementById('stallMapAssignSaveBtn');
  var closeBtn = document.getElementById('stallMapAssignModalClose');
  if (inp && !inp.dataset.bound) {
    inp.dataset.bound = '1';
    function stallMapOnAssignInputChanged() {
      var el = document.getElementById('stallMapAssignInput');
      if (!el) return;
      globalThis['__stallMap'].stallMapFillAssignSuggestions(el.value);
    }
    inp.addEventListener('input', stallMapOnAssignInputChanged);
    inp.addEventListener('keyup', stallMapOnAssignInputChanged);
    inp.addEventListener('paste', function () {
      setTimeout(stallMapOnAssignInputChanged, 0);
    });
    inp.addEventListener('compositionend', stallMapOnAssignInputChanged);
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        globalThis['__stallMap'].stallMapAssignSaveFromInput();
      }
    });
  }
  if (assignSaveBtn && !assignSaveBtn.dataset.bound) {
    assignSaveBtn.dataset.bound = '1';
    assignSaveBtn.addEventListener('click', function () {
      globalThis['__stallMap'].stallMapAssignSaveFromInput();
    });
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', function () {
      globalThis['__stallMap'].stallMapCloseAssignModal();
    });
  }
  if (modal && !modal.dataset.overlayBound) {
    modal.dataset.overlayBound = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) globalThis['__stallMap'].stallMapCloseAssignModal();
    });
  }

  var cellModal = document.getElementById('stallMapCellModal');
  var cellClose = document.getElementById('stallMapCellModalCancel');
  var cellUn = document.getElementById('stallMapCellModalUnassign');
  var cellRep = document.getElementById('stallMapCellModalReplace');
  if (cellClose && !cellClose.dataset.bound) {
    cellClose.dataset.bound = '1';
    cellClose.addEventListener('click', function () {
      globalThis['__stallMap'].stallMapCloseCellModal();
    });
  }
  if (cellUn && !cellUn.dataset.bound) {
    cellUn.dataset.bound = '1';
    cellUn.addEventListener('click', function () {
      var ctx = globalThis['__stallMap'].state._stallMapCellModalCtx;
      if (!ctx) return;
      globalThis['__stallMap'].stallMapCloseCellModal();
      globalThis['__stallMap'].stallMapUnassignCell(ctx.yardKey, ctx.row, ctx.place).then(
        function () {
          globalThis['__stallMap'].stallMapRenderGrid();
          globalThis['__stallMap'].stallMapUpdateUnassignedCountUI();
          if (typeof showToast === 'function') showToast('Место освобождено', 'success');
        },
        function () {}
      );
    });
  }
  if (cellRep && !cellRep.dataset.bound) {
    cellRep.dataset.bound = '1';
    cellRep.addEventListener('click', function () {
      var ctx = globalThis['__stallMap'].state._stallMapCellModalCtx;
      if (!ctx) return;
      globalThis['__stallMap'].state._stallMapAssignTarget = { yardKey: ctx.yardKey, row: ctx.row, place: ctx.place };
      globalThis['__stallMap'].stallMapCloseCellModal();
      globalThis['__stallMap'].stallMapOpenAssignModal();
    });
  }
  if (cellModal && !cellModal.dataset.overlayBound) {
    cellModal.dataset.overlayBound = '1';
    cellModal.addEventListener('click', function (e) {
      if (e.target === cellModal) globalThis['__stallMap'].stallMapCloseCellModal();
    });
  }
}


  // register functions
  NS.stallMapRedrawIfActive = stallMapRedrawIfActive;
  NS.stallMapBindLifecycleRefresh = stallMapBindLifecycleRefresh;
  NS.initStallMapScreen = initStallMapScreen;
})();
export {};
