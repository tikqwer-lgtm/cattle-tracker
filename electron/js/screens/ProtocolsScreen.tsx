/**
 * Протоколы синхронизации — React UI; CRUD через js/data/protocols (legacy IIFE).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScreenFrame } from './AppShell';
import { useCapability } from '../data/hooks';
import {
  addProtocol,
  deleteProtocol,
  ensureProtocolsLoaded,
  getProtocolById,
  getProtocols,
  notifyInseminationCodeSelects,
  showConfirmModal,
  updateProtocol,
  type Protocol,
  type ProtocolStep,
} from '../data/protocols';
import { refreshFarmDatalists } from '../data/farm';
import { showToast } from '../data/session';

function asPromise(value: unknown): Promise<unknown> {
  if (value && typeof (value as Promise<unknown>).then === 'function') {
    return value as Promise<unknown>;
  }
  return Promise.resolve(value);
}

export default function ProtocolsScreen(): React.ReactElement {
  const canEdit = useCapability('eventsInput');
  const [list, setList] = useState<Protocol[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<ProtocolStep[]>([{ day: 0, drug: '' }]);
  const [pendingObject, setPendingObject] = useState(false);

  const reload = useCallback(() => {
    try {
      refreshFarmDatalists();
    } catch {
      /* ignore */
    }
    const pend =
      !!(window.CattleTrackerApi &&
        (window.CattleTrackerApi as { PENDING_OBJECT_ID?: string }).PENDING_OBJECT_ID &&
        typeof window.getCurrentObjectId === 'function' &&
        window.getCurrentObjectId() ===
          (window.CattleTrackerApi as { PENDING_OBJECT_ID?: string }).PENDING_OBJECT_ID);
    setPendingObject(!!(window.CATTLE_TRACKER_USE_API && pend));
    setList(getProtocols());
  }, []);

  useEffect(() => {
    const p = ensureProtocolsLoaded();
    if (p && typeof (p as Promise<void>).then === 'function') {
      (p as Promise<void>).then(reload).catch(reload);
    } else {
      reload();
    }
  }, [reload]);

  useEffect(() => {
    if (!editingId) {
      setName('');
      setSteps([{ day: 0, drug: '' }]);
      return;
    }
    const p = getProtocolById(editingId);
    if (p) {
      setName(p.name || '');
      setSteps((p.steps && p.steps.length ? p.steps : [{ day: 0, drug: '' }]).map((s) => ({
        day: Number(s.day) || 0,
        drug: String(s.drug || ''),
      })));
    }
  }, [editingId]);

  const startNew = () => {
    setEditingId(null);
    setName('');
    setSteps([{ day: 0, drug: '' }]);
  };

  const onDelete = async (id: string) => {
    const ok = await showConfirmModal('Удалить этот протокол?');
    if (!ok) return;
    await asPromise(deleteProtocol(id));
    setEditingId(null);
    reload();
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Введите название протокола', 'error');
      return;
    }
    const payload = { name: trimmed, steps };
    if (editingId) {
      await asPromise(updateProtocol(editingId, payload));
      showToast('Протокол сохранён', 'success');
    } else {
      await asPromise(addProtocol(payload));
      showToast('Протокол добавлен', 'success');
    }
    setEditingId(null);
    notifyInseminationCodeSelects();
    reload();
  };

  if (pendingObject) {
    return (
      <ScreenFrame title="Протоколы синхронизации">
        <p className="admin-message">
          Сначала выберите базу на экране «Синхронизация» (список баз → «Загрузить»).
        </p>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Протоколы синхронизации">
      <div className="protocols-screen-inner">
        <div className="protocols-list-section">
          <h3>Список протоколов</h3>
          <ul id="protocols-list" className="protocols-list">
            {list.map((p) => (
              <li key={p.id} className="protocols-list-item" data-id={p.id}>
                <span className="protocol-name">{p.name || 'Без названия'}</span>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="small-btn edit-protocol-btn"
                      aria-label="Редактировать"
                      onClick={() => setEditingId(p.id)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="small-btn delete-protocol-btn"
                      aria-label="Удалить"
                      onClick={() => void onDelete(p.id)}
                    >
                      Удалить
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <button type="button" className="action-btn" id="protocols-add-btn" onClick={startNew}>
              ➕ Добавить протокол
            </button>
          )}
        </div>

        {canEdit && (
          <div className="protocols-form-section">
            <h3 id="protocols-form-title">{editingId ? 'Редактировать протокол' : 'Новый протокол'}</h3>
            <form id="protocol-form" className="form" onSubmit={(ev) => void onSave(ev)}>
              <label htmlFor="protocol-name-input">Название протокола</label>
              <input
                type="text"
                id="protocol-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Синхрон-1"
              />
              <label>Этапы (инъекции)</label>
              <div id="protocol-steps-container">
                {steps.map((step, idx) => (
                  <div key={idx} className="protocol-step-row">
                    <label className="step-label">День</label>
                    <input
                      type="number"
                      className="step-day"
                      min={0}
                      step={1}
                      value={step.day}
                      onChange={(e) => {
                        const next = steps.slice();
                        next[idx] = { ...next[idx], day: Number(e.target.value) || 0 };
                        setSteps(next);
                      }}
                    />
                    <label className="step-label">Препарат</label>
                    <input
                      type="text"
                      className="step-drug"
                      list="datalist-farm-drugs"
                      autoComplete="off"
                      placeholder="Название инъекции"
                      value={step.drug}
                      onChange={(e) => {
                        const next = steps.slice();
                        next[idx] = { ...next[idx], drug: e.target.value };
                        setSteps(next);
                      }}
                    />
                    <button
                      type="button"
                      className="small-btn remove-step-btn"
                      aria-label="Удалить этап"
                      onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="small-btn"
                id="protocol-add-step-btn"
                onClick={() => setSteps([...steps, { day: 0, drug: '' }])}
              >
                ➕ Добавить этап
              </button>
              <div className="form-actions">
                <button type="button" id="protocol-cancel-btn" onClick={startNew}>
                  Отмена
                </button>
                <button type="submit" id="protocol-save-btn">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ScreenFrame>
  );
}
