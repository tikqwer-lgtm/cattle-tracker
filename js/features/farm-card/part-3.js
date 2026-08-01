/** __farmCard part 3 — CRM: пункты, цели, динамика, печать, импорт-заглушка */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__farmCard'] = root['__farmCard'] || {};
  var global = typeof window !== 'undefined' ? window : this;

  var ITEM_TYPE_LABELS = {
    text: 'Текст',
    number: 'Число',
    date: 'Дата',
    image: 'Картинка',
    geo: 'Геолокация'
  };

  var GOAL_STATUS_LABELS = {
    open: 'Открыта',
    done: 'Выполнена',
    overdue: 'Просрочена'
  };

  var IMAGE_MAX_BYTES = 280 * 1024;
  var _dynamicsChart = null;

  function escapeHtml(s) {
    return NS.escapeHtml ? NS.escapeHtml(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function newId(prefix) {
    return NS.newId ? NS.newId(prefix) : prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function geoNavUrl(value) {
    if (!value || typeof value !== 'object') return '';
    if (value.navUrl) return String(value.navUrl);
    if (value.lat != null && value.lng != null && !isNaN(value.lat) && !isNaN(value.lng)) {
      return 'https://yandex.ru/maps/?rtext=~' + value.lat + ',' + value.lng;
    }
    if (value.label) {
      return 'https://yandex.ru/maps/?text=' + encodeURIComponent(value.label);
    }
    return '';
  }

  function formatItemValue(item) {
    if (!item) return '—';
    if (item.type === 'geo') {
      var g = item.value || {};
      if (g.label) return g.label;
      if (g.lat != null && g.lng != null) return Number(g.lat).toFixed(5) + ', ' + Number(g.lng).toFixed(5);
      return '—';
    }
    if (item.type === 'image') {
      return item.value ? '📷 фото' : '—';
    }
    if (item.value == null || item.value === '') return '—';
    return String(item.value);
  }

  function openGeoNavigator(value) {
    var url = geoNavUrl(value);
    if (!url) {
      if (typeof showToast === 'function') showToast('Нет координат для навигации', 'error');
      return;
    }
    try {
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      location.href = url;
    }
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Выберите изображение'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Не удалось прочитать файл'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error('Некорректное изображение'));
        };
        img.onload = function () {
          var maxSide = 1280;
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var quality = 0.72;
          var dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > IMAGE_MAX_BYTES * 1.37 && quality > 0.35) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > IMAGE_MAX_BYTES * 1.37) {
            reject(new Error('Фото слишком большое после сжатия (лимит ~280 КБ)'));
            return;
          }
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function getCurrentPosition() {
    return new Promise(function (resolve, reject) {
      var Cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
      if (Cap && typeof Cap.getCurrentPosition === 'function') {
        Cap.getCurrentPosition({ enableHighAccuracy: true })
          .then(function (pos) {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          })
          .catch(reject);
        return;
      }
      if (!navigator.geolocation) {
        reject(new Error('Геолокация недоступна'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        function (err) {
          reject(err || new Error('Не удалось получить координаты'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    });
  }

  function buildCrmTabsHtml(activeTab) {
    var tabs = [
      ['addresses', 'Адреса'],
      ['specialists', 'Специалисты'],
      ['goals', 'Цели'],
      ['timeline', 'Лента событий']
    ];
    return tabs
      .map(function (t) {
        return (
          '<button type="button" class="farm-card-tab' +
          (activeTab === t[0] ? ' farm-card-tab--active' : '') +
          '" data-farm-tab="' +
          t[0] +
          '">' +
          t[1] +
          '</button>'
        );
      })
      .join('');
  }

  function buildItemsPaneHtml(b, canEdit, activeTab) {
    var items = (b.items || []).slice().sort(function (a, c) {
      return (a.sortOrder || 0) - (c.sortOrder || 0);
    });
    var rows = items
      .map(function (it) {
        var valHtml = '';
        if (it.type === 'image' && it.value) {
          valHtml =
            '<img class="farm-card-item-thumb" src="' +
            escapeHtml(it.value) +
            '" alt="" />';
        } else if (it.type === 'geo') {
          valHtml =
            '<button type="button" class="link-btn farm-card-geo-open" data-item-id="' +
            escapeHtml(it.id) +
            '">' +
            escapeHtml(formatItemValue(it)) +
            '</button>';
        } else {
          valHtml = escapeHtml(formatItemValue(it));
        }
        return (
          '<tr data-item-id="' +
          escapeHtml(it.id) +
          '"><td>' +
          escapeHtml(it.label) +
          '</td><td><small>' +
          escapeHtml(ITEM_TYPE_LABELS[it.type] || it.type) +
          '</small></td><td class="farm-card-item-value">' +
          valHtml +
          '</td><td><small>' +
          escapeHtml((it.updatedAt || '').slice(0, 10)) +
          '</small></td>' +
          (canEdit
            ? '<td><button type="button" class="small-btn farm-card-item-del" data-item-id="' +
              escapeHtml(it.id) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="farm-card-pane" id="farmCardPaneItems" style="' +
      (activeTab === 'items' ? '' : 'display:none') +
      '">' +
      '<p class="farm-settings-hint">Пункты «название → содержание» добавляются по потребности и хранятся в общем стеке карточки.</p>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Пункт</th><th>Тип</th><th>Содержание</th><th>Обновлён</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="farm-card-empty">Нет пунктов</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form farm-card-form--mobile">' +
          '<h4 class="farm-card-h4">Новый пункт</h4>' +
          '<label>Название <input type="text" id="farmCardNewItemLabel" class="farm-settings-inline-input farm-card-input-lg" placeholder="Например: Удой / Координаты фермы" /></label>' +
          '<label>Тип <select id="farmCardNewItemType" class="farm-card-input-lg">' +
          '<option value="text">Текст</option>' +
          '<option value="number">Число</option>' +
          '<option value="date">Дата</option>' +
          '<option value="image">Картинка</option>' +
          '<option value="geo">Геолокация</option></select></label>' +
          '<div id="farmCardNewItemValueWrap">' +
          '<label>Значение <input type="text" id="farmCardNewItemValue" class="farm-settings-inline-input farm-card-input-lg" /></label>' +
          '</div>' +
          '<div class="farm-card-actions-row">' +
          '<button type="button" class="action-btn" id="farmCardAddItemBtn">Добавить пункт</button>' +
          '<button type="button" class="small-btn" id="farmCardImportHerdStubBtn" title="Импорт из DC305 / Afifarm / Uniform">Импорт показателей…</button>' +
          '</div></div>'
        : '') +
      '</div>'
    );
  }

  function buildGoalsPaneHtml(b, canEdit, activeTab) {
    var goals = (b.goals || []).slice().sort(function (a, c) {
      return String(a.deadline || '').localeCompare(String(c.deadline || ''));
    });
    var rows = goals
      .map(function (g) {
        var st = GOAL_STATUS_LABELS[g.status] || g.status;
        var cls = g.status === 'overdue' ? ' farm-card-goal--overdue' : g.status === 'done' ? ' farm-card-goal--done' : '';
        return (
          '<tr class="' +
          cls.trim() +
          '" data-goal-id="' +
          escapeHtml(g.id) +
          '"><td>' +
          escapeHtml(g.title) +
          '</td><td>' +
          escapeHtml(g.deadline || '—') +
          '</td><td>' +
          escapeHtml(st) +
          '</td><td>' +
          escapeHtml(g.notes || '') +
          '</td>' +
          (canEdit
            ? '<td class="farm-card-goal-actions">' +
              (g.status !== 'done'
                ? '<button type="button" class="small-btn farm-card-goal-done" data-goal-id="' +
                  escapeHtml(g.id) +
                  '">Готово</button> '
                : '<button type="button" class="small-btn farm-card-goal-reopen" data-goal-id="' +
                  escapeHtml(g.id) +
                  '">Открыть</button> ') +
              '<button type="button" class="small-btn farm-card-goal-del" data-goal-id="' +
              escapeHtml(g.id) +
              '">Удал.</button></td>'
            : '') +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="farm-card-pane" id="farmCardPaneGoals" style="' +
      (activeTab === 'goals' ? '' : 'display:none') +
      '">' +
      '<p class="farm-settings-hint">Цели со сроками; просроченные помечаются автоматически.</p>' +
      '<div class="farm-card-table-scroll"><table class="farm-card-table"><thead><tr><th>Цель</th><th>Срок</th><th>Статус</th><th>Заметки</th>' +
      (canEdit ? '<th></th>' : '') +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="farm-card-empty">Нет целей</td></tr>') +
      '</tbody></table></div>' +
      (canEdit
        ? '<div class="farm-card-form farm-card-form--mobile">' +
          '<h4 class="farm-card-h4">Новая цель</h4>' +
          '<label>Название <input type="text" id="farmCardNewGoalTitle" class="farm-settings-inline-input farm-card-input-lg" /></label>' +
          '<label>Срок <input type="date" id="farmCardNewGoalDeadline" class="farm-card-input-lg" /></label>' +
          '<label>Заметки <textarea id="farmCardNewGoalNotes" class="farm-settings-textarea" rows="2"></textarea></label>' +
          '<button type="button" class="action-btn" id="farmCardAddGoalBtn">Добавить цель</button></div>'
        : '') +
      '</div>'
    );
  }

  function collectDynamicsSeries(b) {
    var series = [];
    (b.metricDefinitions || []).forEach(function (def) {
      var points = (b.metricValues || [])
        .filter(function (v) {
          return v && v.metricId === def.id;
        })
        .map(function (v) {
          return { date: String(v.valueDate || ''), value: parseFloat(String(v.valueText).replace(',', '.')) };
        })
        .filter(function (p) {
          return p.date && !isNaN(p.value);
        })
        .sort(function (a, c) {
          return a.date.localeCompare(c.date);
        });
      if (points.length) {
        series.push({ id: 'm:' + def.id, label: def.label || def.id, points: points });
      }
    });
    (b.items || []).forEach(function (it) {
      if (!it || it.type !== 'number') return;
      var num = Number(it.value);
      if (isNaN(num)) return;
      var d = (it.updatedAt || '').slice(0, 10) || todayIso();
      series.push({
        id: 'i:' + it.id,
        label: it.label || it.id,
        points: [{ date: d, value: num }]
      });
    });
    return series;
  }

  function buildDynamicsPaneHtml(b, canEdit, activeTab) {
    var series = collectDynamicsSeries(b);
    var checks = series
      .map(function (s) {
        return (
          '<label class="farm-card-dyn-check"><input type="checkbox" class="farm-card-dyn-metric" value="' +
          escapeHtml(s.id) +
          '" /> ' +
          escapeHtml(s.label) +
          ' <small>(' +
          s.points.length +
          ')</small></label>'
        );
      })
      .join('');

    return (
      '<div class="farm-card-pane" id="farmCardPaneDynamics" style="' +
      (activeTab === 'dynamics' ? '' : 'display:none') +
      '">' +
      '<p class="farm-settings-hint">Сравнение динамики числовых показателей. Для CR/HDR/PR по месяцам отметьте месячные показатели и нажмите «Показать».</p>' +
      (checks
        ? '<div class="farm-card-dyn-checks">' +
          checks +
          '</div><div class="farm-card-actions-row">' +
          '<button type="button" class="small-btn" id="farmCardDynRenderBtn">Показать</button></div>' +
          '<div class="farm-card-dyn-chart-wrap"><canvas id="farmCardDynChart" height="220"></canvas></div>' +
          '<div class="farm-card-table-scroll" id="farmCardDynTable"></div>'
        : '<p class="farm-card-empty">Нет числовых рядов. Добавьте показатели или числовые пункты.</p>') +
      '</div>'
    );
  }

  function renderDynamicsChart(selectedIds) {
    var b = window.__farmCardBundle || {};
    var all = collectDynamicsSeries(b);
    var selected = all.filter(function (s) {
      return selectedIds.indexOf(s.id) !== -1;
    });
    var tableEl = document.getElementById('farmCardDynTable');
    var canvas = document.getElementById('farmCardDynChart');
    if (!selected.length) {
      if (tableEl) tableEl.innerHTML = '<p class="farm-settings-hint">Выберите показатели</p>';
      if (_dynamicsChart && typeof _dynamicsChart.destroy === 'function') {
        _dynamicsChart.destroy();
        _dynamicsChart = null;
      }
      return;
    }
    var dateSet = {};
    selected.forEach(function (s) {
      s.points.forEach(function (p) {
        dateSet[p.date] = true;
      });
    });
    var labels = Object.keys(dateSet).sort();
    var colors = ['#1e3a5f', '#2a9d8f', '#e76f51', '#457b9d', '#bc6c25', '#6d597a'];
    var datasets = selected.map(function (s, i) {
      var byDate = {};
      s.points.forEach(function (p) {
        byDate[p.date] = p.value;
      });
      return {
        label: s.label,
        data: labels.map(function (d) {
          return byDate[d] != null ? byDate[d] : null;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length],
        spanGaps: true,
        tension: 0.2
      };
    });

    if (typeof Chart !== 'undefined' && canvas) {
      if (_dynamicsChart && typeof _dynamicsChart.destroy === 'function') _dynamicsChart.destroy();
      _dynamicsChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: false } }
        }
      });
    }

    if (tableEl) {
      var head =
        '<tr><th>Дата</th>' +
        selected
          .map(function (s) {
            return '<th>' + escapeHtml(s.label) + '</th>';
          })
          .join('') +
        '</tr>';
      var body = labels
        .map(function (d) {
          return (
            '<tr><td>' +
            escapeHtml(d) +
            '</td>' +
            selected
              .map(function (s) {
                var p = s.points.find(function (x) {
                  return x.date === d;
                });
                var prev = null;
                for (var i = s.points.length - 1; i >= 0; i--) {
                  if (s.points[i].date < d) {
                    prev = s.points[i];
                    break;
                  }
                }
                var cell = p ? String(p.value) : '—';
                if (p && prev) {
                  var delta = p.value - prev.value;
                  cell +=
                    ' <small class="' +
                    (delta > 0 ? 'farm-card-delta-up' : delta < 0 ? 'farm-card-delta-down' : '') +
                    '">(' +
                    (delta > 0 ? '+' : '') +
                    delta.toFixed(1) +
                    ')</small>';
                }
                return '<td>' + cell + '</td>';
              })
              .join('') +
            '</tr>'
          );
        })
        .join('');
      tableEl.innerHTML =
        '<table class="farm-card-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
    }
  }

  function resolveFarmObjectName(b) {
    var oid = typeof window.getCurrentObjectId === 'function' ? window.getCurrentObjectId() : '';
    var list = typeof window.getObjectsList === 'function' ? window.getObjectsList() : null;
    if (oid && Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === oid) {
          var fromList = list[i].name != null ? String(list[i].name).trim() : '';
          if (fromList) return fromList;
          break;
        }
      }
    }
    var sel = document.getElementById('currentObjectSelect');
    if (sel && sel.options && sel.selectedIndex >= 0) {
      var optText = String(sel.options[sel.selectedIndex].text || '').trim();
      if (optText) return optText;
    }
    if (b && b.name != null && String(b.name).trim()) return String(b.name).trim();
    return 'Хозяйство';
  }

  function buildPrintOverviewHtml(b) {
    var name = resolveFarmObjectName(b);
    var info = b.addressInfo || {};
    var addrParts = [info.region, info.locality, info.address]
      .map(function (x) {
        return x != null ? String(x).trim() : '';
      })
      .filter(Boolean);
    var geos = (b.addresses || [])
      .slice(0, 12)
      .map(function (a) {
        return (
          '<li>' +
          escapeHtml(a.name || 'Геопозиция') +
          (a.navUrl ? ' — ' + escapeHtml(a.navUrl) : '') +
          '</li>'
        );
      })
      .join('');
    var specialists = (b.specialists || [])
      .slice(0, 12)
      .map(function (s) {
        var role = (s.role || s.title || '').trim();
        var fio = (s.name || s.fullName || '').trim();
        var phones = Array.isArray(s.phones)
          ? s.phones
              .map(function (p) {
                return String(p || '').trim();
              })
              .filter(Boolean)
              .join(', ')
          : s.phone
            ? String(s.phone).trim()
            : '';
        var parts = [];
        if (role) parts.push(role);
        if (fio) parts.push(fio);
        if (phones) parts.push(phones);
        return '<li>' + escapeHtml(parts.join(' — ') || '—') + '</li>';
      })
      .join('');
    var goals = (b.goals || [])
      .filter(function (g) {
        return g.status !== 'done';
      })
      .slice(0, 10)
      .map(function (g) {
        return (
          '<li>' +
          escapeHtml(g.title) +
          ' — до ' +
          escapeHtml(g.deadline || '—') +
          ' (' +
          escapeHtml(GOAL_STATUS_LABELS[g.status] || g.status) +
          ')</li>'
        );
      })
      .join('');
    var today = todayIso();
    var events = (b.events || [])
      .filter(function (e) {
        return !e.completed && String(e.eventDate || '') >= today;
      })
      .sort(function (a, c) {
        return String(a.eventDate).localeCompare(String(c.eventDate));
      })
      .slice(0, 8)
      .map(function (e) {
        var label =
          (e.title && String(e.title).trim()) ||
          e.description ||
          e.task ||
          e.goal ||
          e.eventType;
        return (
          '<li>' +
          escapeHtml(e.eventDate) +
          ': ' +
          escapeHtml(label) +
          '</li>'
        );
      })
      .join('');

    return (
      '<div class="farm-card-print-sheet">' +
      '<h2>Карточка хозяйства: ' +
      escapeHtml(name) +
      '</h2>' +
      '<p class="farm-card-print-date">Краткий обзор на ' +
      escapeHtml(today) +
      '</p>' +
      '<h3>Адреса</h3>' +
      (addrParts.length ? '<p>' + escapeHtml(addrParts.join(', ')) + '</p>' : '') +
      '<ul>' +
      (geos || '<li>—</li>') +
      '</ul>' +
      '<h3>Специалисты</h3><ul>' +
      (specialists || '<li>—</li>') +
      '</ul>' +
      '<h3>Открытые цели</h3><ul>' +
      (goals || '<li>—</li>') +
      '</ul>' +
      '<h3>Ближайшие события</h3><ul>' +
      (events || '<li>—</li>') +
      '</ul></div>'
    );
  }

  function printFarmCard() {
    var b = window.__farmCardBundle || NS.emptyBundle();
    var sheet = document.getElementById('farmCardPrintSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'farmCardPrintSheet';
      sheet.className = 'farm-card-print-sheet-host';
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = buildPrintOverviewHtml(b);
    var titleEl = document.getElementById('print-doc-title');
    var dateEl = document.getElementById('print-doc-date');
    var prevTitle = titleEl ? titleEl.textContent : '';
    var prevDate = dateEl ? dateEl.textContent : '';
    if (titleEl) titleEl.textContent = '';
    if (dateEl) dateEl.textContent = '';
    document.body.classList.add('print-farm-card');
    var cleanup = function () {
      document.body.classList.remove('print-farm-card');
      if (titleEl) titleEl.textContent = prevTitle || 'Опись стада';
      if (dateEl) dateEl.textContent = prevDate || '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () {
      window.print();
      setTimeout(cleanup, 500);
    }, 50);
  }

  function updateItemValueFields() {
    var typeEl = document.getElementById('farmCardNewItemType');
    var wrap = document.getElementById('farmCardNewItemValueWrap');
    if (!typeEl || !wrap) return;
    var type = typeEl.value || 'text';
    if (type === 'text') {
      wrap.innerHTML =
        '<label>Значение <input type="text" id="farmCardNewItemValue" class="farm-settings-inline-input farm-card-input-lg" /></label>';
    } else if (type === 'number') {
      wrap.innerHTML =
        '<label>Значение <input type="number" step="any" id="farmCardNewItemValue" class="farm-settings-inline-input farm-card-input-lg" /></label>';
    } else if (type === 'date') {
      wrap.innerHTML =
        '<label>Дата <input type="date" id="farmCardNewItemValue" class="farm-card-input-lg" value="' +
        todayIso() +
        '" /></label>';
    } else if (type === 'image') {
      wrap.innerHTML =
        '<label>Фото <input type="file" id="farmCardNewItemFile" accept="image/*" capture="environment" class="farm-card-input-lg" /></label>' +
        '<p class="farm-settings-hint">Сжимается до ~280 КБ (JPEG).</p>';
    } else if (type === 'geo') {
      wrap.innerHTML =
        '<label>Подпись <input type="text" id="farmCardNewItemGeoLabel" class="farm-settings-inline-input farm-card-input-lg" placeholder="Точка на карте" /></label>' +
        '<div class="farm-card-grid2">' +
        '<label>Широта <input type="number" step="any" id="farmCardNewItemLat" class="farm-settings-inline-input farm-card-input-lg" /></label>' +
        '<label>Долгота <input type="number" step="any" id="farmCardNewItemLng" class="farm-settings-inline-input farm-card-input-lg" /></label></div>' +
        '<button type="button" class="small-btn" id="farmCardGeoHereBtn">Текущее место</button>';
      var here = document.getElementById('farmCardGeoHereBtn');
      if (here) {
        here.onclick = function () {
          here.disabled = true;
          getCurrentPosition()
            .then(function (pos) {
              var latEl = document.getElementById('farmCardNewItemLat');
              var lngEl = document.getElementById('farmCardNewItemLng');
              if (latEl) latEl.value = String(pos.lat);
              if (lngEl) lngEl.value = String(pos.lng);
              if (typeof showToast === 'function') showToast('Координаты получены', 'success');
            })
            .catch(function (e) {
              if (typeof showToast === 'function')
                showToast((e && e.message) || 'Геолокация недоступна', 'error');
            })
            .then(function () {
              here.disabled = false;
            });
        };
      }
    }
  }

  function emitGoalChanged(goals) {
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('farm-goal:changed', goals || []);
    }
  }

  function showImportStub() {
    if (window.CattleTrackerHerdImport && typeof window.CattleTrackerHerdImport.downloadTemplate === 'function') {
      if (typeof showToast === 'function') {
        showToast('Скачайте шаблон KPI и загрузите его кнопкой «Импорт KPI» на вкладке Показатели', 'info');
      }
      return;
    }
    if (typeof window.CattleTrackerHerdImport !== 'undefined' && window.CattleTrackerHerdImport.showStub) {
      window.CattleTrackerHerdImport.showStub();
      return;
    }
    if (typeof showToast === 'function') {
      showToast('Импорт KPI — на вкладке Показатели', 'info');
    }
  }

  function bindCrmHandlers(rootEl, canEdit, renderFn) {
    if (!rootEl) return;

    var printBtn = document.getElementById('farmCardPrintBtn');
    if (printBtn) {
      printBtn.onclick = function () {
        printFarmCard();
      };
    }

    rootEl.querySelectorAll('.farm-card-geo-open').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-item-id');
        var item = ((window.__farmCardBundle && window.__farmCardBundle.items) || []).find(function (it) {
          return it && it.id === id;
        });
        if (item) openGeoNavigator(item.value);
      };
    });

    if (!canEdit) return;

    var typeEl = document.getElementById('farmCardNewItemType');
    if (typeEl) {
      typeEl.onchange = updateItemValueFields;
      updateItemValueFields();
    }

    var addItem = document.getElementById('farmCardAddItemBtn');
    if (addItem) {
      addItem.onclick = function () {
        var label = ((document.getElementById('farmCardNewItemLabel') || {}).value || '').trim();
        var type = (document.getElementById('farmCardNewItemType') || {}).value || 'text';
        if (!label) {
          if (typeof showToast === 'function') showToast('Укажите название пункта', 'error');
          return;
        }
        if (!window.__farmCardBundle.items) window.__farmCardBundle.items = [];
        var oid = NS.getObjectIdForFarm ? NS.getObjectIdForFarm() : '';

        function pushItem(value) {
          window.__farmCardBundle.items.push({
            id: newId('it_'),
            label: label,
            type: type,
            value: value,
            updatedAt: nowIso(),
            sortOrder: window.__farmCardBundle.items.length,
            objectId: oid || ''
          });
          if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
          renderFn();
        }

        if (type === 'image') {
          var fileEl = document.getElementById('farmCardNewItemFile');
          var file = fileEl && fileEl.files && fileEl.files[0];
          if (!file) {
            if (typeof showToast === 'function') showToast('Выберите фото', 'error');
            return;
          }
          addItem.disabled = true;
          compressImageFile(file)
            .then(function (dataUrl) {
              pushItem(dataUrl);
            })
            .catch(function (e) {
              if (typeof showToast === 'function') showToast((e && e.message) || 'Ошибка фото', 'error');
            })
            .then(function () {
              addItem.disabled = false;
            });
          return;
        }
        if (type === 'geo') {
          var lat = parseFloat((document.getElementById('farmCardNewItemLat') || {}).value);
          var lng = parseFloat((document.getElementById('farmCardNewItemLng') || {}).value);
          var geoLabel = ((document.getElementById('farmCardNewItemGeoLabel') || {}).value || '').trim() || label;
          if (isNaN(lat) || isNaN(lng)) {
            if (typeof showToast === 'function') showToast('Укажите координаты или нажмите «Текущее место»', 'error');
            return;
          }
          pushItem({
            lat: lat,
            lng: lng,
            label: geoLabel,
            navUrl: 'https://yandex.ru/maps/?rtext=~' + lat + ',' + lng
          });
          return;
        }
        var rawVal = (document.getElementById('farmCardNewItemValue') || {}).value;
        if (type === 'number') {
          var num = parseFloat(rawVal);
          if (rawVal === '' || isNaN(num)) {
            if (typeof showToast === 'function') showToast('Укажите число', 'error');
            return;
          }
          pushItem(num);
          return;
        }
        pushItem(rawVal != null ? String(rawVal) : '');
      };
    }

    rootEl.querySelectorAll('.farm-card-item-del').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-item-id');
        window.__farmCardBundle.items = (window.__farmCardBundle.items || []).filter(function (it) {
          return it && it.id !== id;
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        renderFn();
      };
    });

    var importBtn = document.getElementById('farmCardImportHerdStubBtn');
    if (importBtn) importBtn.onclick = showImportStub;

    var deadlineEl = document.getElementById('farmCardNewGoalDeadline');
    if (deadlineEl && !deadlineEl.value) deadlineEl.value = todayIso();

    var addGoal = document.getElementById('farmCardAddGoalBtn');
    if (addGoal) {
      addGoal.onclick = function () {
        var title = ((document.getElementById('farmCardNewGoalTitle') || {}).value || '').trim();
        var deadline = (document.getElementById('farmCardNewGoalDeadline') || {}).value || '';
        var notes = (document.getElementById('farmCardNewGoalNotes') || {}).value || '';
        if (!title) {
          if (typeof showToast === 'function') showToast('Укажите название цели', 'error');
          return;
        }
        if (!window.__farmCardBundle.goals) window.__farmCardBundle.goals = [];
        var status = 'open';
        if (deadline && deadline < todayIso()) status = 'overdue';
        window.__farmCardBundle.goals.push({
          id: newId('g_'),
          title: title,
          deadline: deadline,
          status: status,
          linkedItemIds: [],
          notes: notes
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        emitGoalChanged(window.__farmCardBundle.goals);
        renderFn();
      };
    }

    rootEl.querySelectorAll('.farm-card-goal-done').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-goal-id');
        (window.__farmCardBundle.goals || []).forEach(function (g) {
          if (g && g.id === id) g.status = 'done';
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        emitGoalChanged(window.__farmCardBundle.goals);
        renderFn();
      };
    });
    rootEl.querySelectorAll('.farm-card-goal-reopen').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-goal-id');
        (window.__farmCardBundle.goals || []).forEach(function (g) {
          if (g && g.id === id) {
            g.status = g.deadline && g.deadline < todayIso() ? 'overdue' : 'open';
          }
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        emitGoalChanged(window.__farmCardBundle.goals);
        renderFn();
      };
    });
    rootEl.querySelectorAll('.farm-card-goal-del').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-goal-id');
        window.__farmCardBundle.goals = (window.__farmCardBundle.goals || []).filter(function (g) {
          return g && g.id !== id;
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        emitGoalChanged(window.__farmCardBundle.goals);
        renderFn();
      };
    });

    var dynBtn = document.getElementById('farmCardDynRenderBtn');
    if (dynBtn) {
      dynBtn.onclick = function () {
        var ids = [];
        rootEl.querySelectorAll('.farm-card-dyn-metric:checked').forEach(function (cb) {
          ids.push(cb.value);
        });
        renderDynamicsChart(ids);
      };
    }

    rootEl.querySelectorAll('.farm-card-ev-toggle').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-ev-id');
        (window.__farmCardBundle.events || []).forEach(function (e) {
          if (e && e.id === id) e.completed = !e.completed;
        });
        if (typeof NS.markFarmCardDirty === 'function') NS.markFarmCardDirty();
        renderFn();
      };
    });
  }

  function enhanceTimelineEventForm() {
    /* Напоминания убраны из новой формы ленты — no-op. */
  }

  function patchAddEventHandler() {
    /* Сохранение события обрабатывается в part-1 — no-op. */
  }

  NS.ITEM_TYPE_LABELS = ITEM_TYPE_LABELS;
  NS.GOAL_STATUS_LABELS = GOAL_STATUS_LABELS;
  NS.buildCrmTabsHtml = buildCrmTabsHtml;
  NS.buildItemsPaneHtml = buildItemsPaneHtml;
  NS.buildGoalsPaneHtml = buildGoalsPaneHtml;
  NS.buildDynamicsPaneHtml = buildDynamicsPaneHtml;
  NS.bindCrmHandlers = bindCrmHandlers;
  NS.printFarmCard = printFarmCard;
  NS.openGeoNavigator = openGeoNavigator;
  NS.compressImageFile = compressImageFile;
  NS.collectDynamicsSeries = collectDynamicsSeries;
  NS.renderDynamicsChart = renderDynamicsChart;
  NS.enhanceTimelineEventForm = enhanceTimelineEventForm;
  NS.patchAddEventHandler = patchAddEventHandler;
  NS.formatItemValue = formatItemValue;
  NS.showImportStub = showImportStub;
})();
export {};
