import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { modelsForPlatform, searchPhoneModels } from '@shared/phone-models';
import type { AppState, NewPhoneModel, PhoneModel, PhonePlatform } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { Icon } from '../lib/icons';
import { Overlay } from './Modals';

interface ModelsSheetProps {
  initialPlatform: PhonePlatform;
  state: AppState;
  actions: PhoneActions;
  onClose: () => void;
}

interface ModelForm {
  name: string;
  manufacturer: string;
  osVersion: string;
  width: string;
  height: string;
  inches: string;
  frameColor: string;
}

const SWATCHES = ['#a49d92', '#3d3e40', '#4b5fbf', '#e7c7c5', '#b8b1a3', '#373b3e', '#7f9fae', '#d9d7d1'];

function blankForm(platform: PhonePlatform): ModelForm {
  return {
    name: '',
    manufacturer: platform === 'ios' ? 'Apple' : '',
    osVersion: platform === 'ios' ? '26' : '16',
    width: platform === 'ios' ? '1179' : '1080',
    height: platform === 'ios' ? '2556' : '2400',
    inches: '6.1',
    frameColor: platform === 'ios' ? '#a49d92' : '#373b3e',
  };
}

function platformLabel(platform: PhonePlatform): string {
  return platform === 'ios' ? 'iPhone' : 'Android';
}

export function ModelsSheet({
  initialPlatform,
  state,
  actions,
  onClose,
}: ModelsSheetProps): ReactElement {
  const [platform, setPlatform] = useState<PhonePlatform>(initialPlatform);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ModelForm>(() => blankForm(initialPlatform));
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(initialPlatform);
    setQuery('');
    setAdding(false);
    setForm(blankForm(initialPlatform));
    setError(null);
  }, [initialPlatform]);

  const allModels = useMemo(
    () => modelsForPlatform(state.models, platform),
    [state.models, platform],
  );
  const visible = useMemo(() => searchPhoneModels(allModels, query), [allModels, query]);
  const currentId = state.devices.find((device) => device.id === `demo-${platform}`)?.modelId ?? null;
  const defaultId = state.defaultModels[platform];

  const switchPlatform = (next: PhonePlatform): void => {
    setPlatform(next);
    setQuery('');
    setForm(blankForm(next));
    setError(null);
  };

  const startAdding = (): void => {
    const next = blankForm(platform);
    if (query.trim() && !allModels.some((model) => model.name.toLowerCase() === query.trim().toLowerCase())) {
      next.name = query.trim();
    }
    setForm(next);
    setAdding(true);
    setError(null);
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Give this phone a name.');
      return;
    }
    const width = Number(form.width);
    const height = Number(form.height);
    const inches = Number(form.inches);
    if (!Number.isFinite(width) || width < 320 || width > 5000) {
      setError('Screen width must be between 320 and 5000 px.');
      return;
    }
    if (!Number.isFinite(height) || height < 480 || height > 5000) {
      setError('Screen height must be between 480 and 5000 px.');
      return;
    }
    if (!Number.isFinite(inches) || inches < 3 || inches > 12) {
      setError('Screen size must be between 3 and 12 inches.');
      return;
    }
    const input: NewPhoneModel = {
      platform,
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || (platform === 'ios' ? 'Apple' : 'Custom'),
      osVersion: form.osVersion.trim() || (platform === 'ios' ? '26' : '16'),
      screen: { width, height },
      displayInches: inches,
      frameColor: /^#[0-9a-f]{6}$/i.test(form.frameColor) ? form.frameColor : '#8b8f96',
    };
    await actions.addPhoneModel(input);
    setAdding(false);
    setQuery('');
    setError(null);
    window.setTimeout(() => {
      const rows = listRef.current?.querySelectorAll<HTMLElement>('.model-row');
      if (!rows?.length) return;
      rows[rows.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 180);
  };

  const update = (key: keyof ModelForm, value: string): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const remove = (model: PhoneModel): void => {
    if (!window.confirm(`Remove “${model.name}” from your models?`)) return;
    void actions.deletePhoneModel(model.id);
  };

  return (
    <Overlay onClose={onClose} className="modal-models" label="Phone models">
      <header className="modal-head model-head">
        <div>
          <div className="eyebrow">DEMO HARDWARE</div>
          <h2>Phone models</h2>
          <p>Choose the hardware for each demo tab, or add your own profile.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
      </header>

      <div className="model-toolbar">
        <div className="model-tabs" role="tablist" aria-label="Phone platforms">
          {(['android', 'ios'] as const).map((item) => {
            const count = state.models.filter((model) => model.platform === item).length;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={platform === item}
                className={`model-tab ${platform === item ? 'is-active' : ''}`}
                onClick={() => switchPlatform(item)}
              >
                <Icon name={item === 'ios' ? 'apple' : 'android'} size={14} />
                {platformLabel(item)}
                <span className="model-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={startAdding}>
          <Icon name="plus" size={14} />
          Add model
        </button>
      </div>

      <div className="model-search-row">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${platformLabel(platform)} models — name, brand, size…`}
            aria-label={`Search ${platformLabel(platform)} models`}
            autoFocus
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear model search"
            >
              <Icon name="x" size={12} />
            </button>
          ) : null}
        </div>
        <span className="model-count">
          {visible.length} of {allModels.length}
        </span>
      </div>

      {adding ? (
        <form className="model-add" onSubmit={submit}>
          <div className="model-add-head">
            <div>
              <strong>Add a {platformLabel(platform)} model</strong>
              <span>Saved to this device and used as your default {platformLabel(platform)} demo.</span>
            </div>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setAdding(false)} aria-label="Cancel add model">
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="model-form-grid">
            <label>
              <span>Model name</span>
              <input
                autoFocus
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder={platform === 'ios' ? 'iPhone 17 Pro' : 'Pixel 10 Pro'}
                maxLength={48}
              />
            </label>
            <label>
              <span>Manufacturer</span>
              <input
                value={form.manufacturer}
                onChange={(event) => update('manufacturer', event.target.value)}
                placeholder={platform === 'ios' ? 'Apple' : 'Google'}
                maxLength={32}
              />
            </label>
            <label>
              <span>OS version</span>
              <input
                value={form.osVersion}
                onChange={(event) => update('osVersion', event.target.value)}
                placeholder={platform === 'ios' ? '26.1' : '16'}
                maxLength={20}
              />
            </label>
            <label>
              <span>Screen size (inches)</span>
              <input
                type="number"
                min="3"
                max="12"
                step="0.1"
                value={form.inches}
                onChange={(event) => update('inches', event.target.value)}
              />
            </label>
            <label>
              <span>Width (px)</span>
              <input
                type="number"
                min="320"
                max="5000"
                step="1"
                value={form.width}
                onChange={(event) => update('width', event.target.value)}
              />
            </label>
            <label>
              <span>Height (px)</span>
              <input
                type="number"
                min="480"
                max="5000"
                step="1"
                value={form.height}
                onChange={(event) => update('height', event.target.value)}
              />
            </label>
            <label className="model-color-field">
              <span>Frame colour</span>
              <span className="model-color-row">
                <input
                  type="color"
                  value={form.frameColor}
                  onChange={(event) => update('frameColor', event.target.value)}
                  aria-label="Frame colour"
                />
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${form.frameColor === color ? 'is-active' : ''}`}
                    style={{ background: color }}
                    onClick={() => update('frameColor', color)}
                    aria-label={`Use frame colour ${color}`}
                  />
                ))}
              </span>
            </label>
          </div>
          {error ? <div className="model-error">{error}</div> : null}
          <div className="model-add-foot">
            <span className="mono-label">CUSTOM PROFILE · {platform.toUpperCase()}</span>
            <div className="row gap-8">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                <Icon name="plus" size={14} />
                Add &amp; set default
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="model-list" ref={listRef}>
        {visible.length === 0 ? (
          <div className="model-empty">
            <span className="empty-icon">
              <Icon name="search" size={20} />
            </span>
            <h3>No {platformLabel(platform)} models match “{query}”</h3>
            <p>Create it and it will be ready for this demo tab.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startAdding}>
              <Icon name="plus" size={13} />
              Add “{query.trim().slice(0, 32)}”
            </button>
          </div>
        ) : (
          visible.map((model) => {
            const isCurrent = model.id === currentId;
            const isDefault = model.id === defaultId;
            return (
              <div
                className={`model-row ${isCurrent ? 'is-current' : ''}`}
                key={model.id}
                data-model-name={model.name}
              >
                <span
                  className="model-swatch"
                  style={{
                    background: `linear-gradient(145deg, ${model.frameColor}, ${model.frameColor}55)`,
                  }}
                  aria-hidden="true"
                >
                  <Icon name="smartphone" size={17} />
                </span>
                <div className="model-row-copy">
                  <div className="model-row-name">
                    <span className="model-name-text">{model.name}</span>
                    {isDefault ? <span className="model-badge default">DEFAULT</span> : null}
                    {!model.builtin ? <span className="model-badge custom">CUSTOM</span> : null}
                  </div>
                  <div className="model-row-meta">
                    {model.manufacturer} · {model.displayInches}&quot; · {model.screen.width}×
                    {model.screen.height} · {platform === 'ios' ? 'iOS' : 'Android'}{' '}
                    {model.osVersion}
                  </div>
                </div>
                <div className="model-row-actions">
                  <button
                    type="button"
                    className={`model-use ${isCurrent ? 'is-current' : ''}`}
                    onClick={() => void actions.selectDemoModel(platform, model.id)}
                  >
                    {isCurrent ? 'In use' : 'Use'}
                  </button>
                  <button
                    type="button"
                    className={`model-star ${isDefault ? 'is-default' : ''}`}
                    onClick={() => void actions.setDefaultModel(platform, model.id)}
                    aria-label={`Set ${model.name} as default ${platformLabel(platform)}`}
                    aria-pressed={isDefault}
                    title={isDefault ? 'Default model' : 'Set as default'}
                  >
                    <Icon name="star" size={14} />
                  </button>
                  {!model.builtin ? (
                    <button
                      type="button"
                      className="model-delete"
                      onClick={() => remove(model)}
                      title={`Remove ${model.name}`}
                      aria-label={`Remove ${model.name}`}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="modal-foot model-foot">
        <div className="model-defaults">
          <span className="mono-label">
            DEFAULT ANDROID · {state.models.find((model) => model.id === state.defaultModels.android)?.name ?? '—'}
          </span>
          <span className="mono-label">
            DEFAULT IPHONE · {state.models.find((model) => model.id === state.defaultModels.ios)?.name ?? '—'}
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Done
        </button>
      </footer>
    </Overlay>
  );
}
