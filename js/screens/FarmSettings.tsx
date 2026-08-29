/**
 * Настройки хозяйства — полный React-экран (без portal в HTML).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScreenFrame } from './AppShell';
import { useCapability } from '../data/hooks';
import {
  fillAllInseminationCodeSelects,
  getChatAssistantSettings,
  getFarmBullsManual,
  getFarmDrugs,
  getFarmTechnicians,
  getFarmVwpDays,
  persistFarmSettingsToServer,
  refreshFarmDatalists,
  setChatAssistantSettings,
  setFarmBullsManual,
  setFarmDrugs,
  setFarmTechnicians,
  setFarmVwpDays,
  type ChatAssistantSettings,
} from '../data/farm';
import { navigate, showToast } from '../data/session';

function ChipList({
  items,
  editable,
  onRemove,
}: {
  items: string[];
  editable: boolean;
  onRemove: (index: number) => void;
}): React.ReactElement {
  return (
    <ul className="farm-settings-chip-list">
      {items.map((text, idx) => (
        <li key={`${text}-${idx}`} className="farm-settings-chip">
          <span className="farm-settings-chip-text">{text}</span>
          {editable && (
            <button
              type="button"
              className="small-btn farm-settings-chip-remove"
              aria-label="Удалить из списка"
              onClick={() => onRemove(idx)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function AddRow({
  placeholder,
  editable,
  onAdd,
}: {
  placeholder: string;
  editable: boolean;
  onAdd: (value: string) => void;
}): React.ReactElement | null {
  const [value, setValue] = useState('');
  if (!editable) return null;

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };

  return (
    <div className="farm-settings-add-row">
      <input
        type="text"
        className="farm-settings-inline-input"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className="small-btn" onClick={submit}>
        Добавить
      </button>
    </div>
  );
}

function ChatAssistantToggles(): React.ReactElement {
  const [settings, setSettings] = useState<ChatAssistantSettings>({
    planHints: true,
    overdueHints: true,
    dailyPlanHints: true,
  });

  useEffect(() => {
    setSettings(getChatAssistantSettings());
  }, []);

  const update = (key: keyof ChatAssistantSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setChatAssistantSettings(next);
  };

  return (
    <div className="farm-settings-chat-toggles">
      <label className="farm-settings-toggle-row">
        <input
          type="checkbox"
          checked={settings.planHints}
          onChange={(e) => update('planHints', e.target.checked)}
        />
        <span>Подсказка по планам («Что дальше»)</span>
      </label>
      <label className="farm-settings-toggle-row">
        <input
          type="checkbox"
          checked={settings.overdueHints}
          onChange={(e) => update('overdueHints', e.target.checked)}
        />
        <span>Подсказка просрочек (на следующий день после задачи)</span>
      </label>
      <label className="farm-settings-toggle-row">
        <input
          type="checkbox"
          checked={settings.dailyPlanHints}
          onChange={(e) => update('dailyPlanHints', e.target.checked)}
        />
        <span>Подсказка плана на день («Дай план» и утреннее напоминание)</span>
      </label>
    </div>
  );
}

export default function FarmSettings(): React.ReactElement {
  const admin = useCapability('farmCardSettings');
  const [tech, setTech] = useState<string[]>([]);
  const [bulls, setBulls] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);
  const [vwp, setVwp] = useState(60);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setTech(getFarmTechnicians());
    setBulls(getFarmBullsManual());
    setDrugs(getFarmDrugs());
    setVwp(getFarmVwpDays());
    refreshFarmDatalists();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addUnique = (list: string[], value: string) => {
    if (list.includes(value)) return list;
    return [...list, value];
  };

  const handleSave = () => {
    if (!admin || saving) return;
    setSaving(true);
    setFarmTechnicians(tech);
    setFarmBullsManual(bulls);
    setFarmDrugs(drugs);
    setFarmVwpDays(vwp);

    const done = () => {
      refreshFarmDatalists();
      fillAllInseminationCodeSelects();
      setSaving(false);
      showToast('Сохранено', 'success');
    };

    const fail = (err: unknown) => {
      refreshFarmDatalists();
      setSaving(false);
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as Error).message)
          : 'Ошибка сохранения на сервере';
      showToast(msg, 'error');
    };

    persistFarmSettingsToServer().then(done).catch(fail);
  };

  return (
    <ScreenFrame title="Настройки хозяйства">
      <div className="farm-settings-wrap">
        <div className="farm-settings-protocols-entry">
          <button type="button" className="action-btn" onClick={() => navigate('protocols')}>
            📋 Протоколы синхронизации
          </button>
        </div>

        <section className="farm-settings-section">
          <h2>Техники ИО</h2>
          <p className="farm-settings-hint">
            Подсказки в поле «Техник ИО» при осеменении и в карточке коровы. Редактирование списка — только
            администратор.
          </p>
          <ChipList
            items={tech}
            editable={admin}
            onRemove={(i) => setTech((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <AddRow
            placeholder="Например: Иванов И.И."
            editable={admin}
            onAdd={(v) => setTech((prev) => addUnique(prev, v))}
          />
        </section>

        <section className="farm-settings-section">
          <h2>Быки (справочник)</h2>
          <p className="farm-settings-hint">
            Дополнительно к быкам из описи. Подсказки в поле «Бык». Редактирование — только администратор.
          </p>
          <ChipList
            items={bulls}
            editable={admin}
            onRemove={(i) => setBulls((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <AddRow
            placeholder="Номер или кличка быка"
            editable={admin}
            onAdd={(v) => setBulls((prev) => addUnique(prev, v))}
          />
        </section>

        <section className="farm-settings-section">
          <h2>Список препаратов</h2>
          <p className="farm-settings-hint">
            Подсказки в шагах протокола синхронизации. Редактирование — только администратор.
          </p>
          <ChipList
            items={drugs}
            editable={admin}
            onRemove={(i) => setDrugs((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <AddRow
            placeholder="Например: ПГ 500"
            editable={admin}
            onAdd={(v) => setDrugs((prev) => addUnique(prev, v))}
          />
        </section>

        <section className="farm-settings-section">
          <h2>ПДО (период добровольного ожидания)</h2>
          <p className="farm-settings-hint">
            После этого количества дней лактации без осеменения появится уведомление о рекомендации ИО.
            Редактирование — только администратор.
          </p>
          <label className="farm-settings-vwp-row">
            <span>Дней</span>
            <input
              type="number"
              className="farm-settings-inline-input farm-settings-vwp-input"
              min={30}
              max={120}
              step={1}
              readOnly={!admin}
              value={vwp}
              onChange={(e) => setVwp(Number(e.target.value))}
            />
          </label>
        </section>

        <section className="farm-settings-section">
          <h2>Код осеменения</h2>
          <p className="farm-settings-hint">
            В списке кода доступны «Охота», «Датчик» и все протоколы из «Протоколы синхронизации» (кнопка выше).
          </p>
        </section>

        <section className="farm-settings-section">
          <h2>Чат-консультант</h2>
          <p className="farm-settings-hint">
            Подсказки по планам работ (уколы, УЗИ, осеменения). Команды в чате: «Что дальше» и «Дай план».
            Настройки сохраняются на этом устройстве.
          </p>
          <ChatAssistantToggles />
        </section>

        {admin && (
          <button type="button" className="action-batch-save-all" disabled={saving} onClick={handleSave}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        )}
      </div>
    </ScreenFrame>
  );
}
