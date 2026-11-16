import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { APP_CATEGORIES } from '@shared/catalog';
import type { AppState, CatalogApp, InstallProgress } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { clockTime, levelTone, storeName, timeAgo, truncate } from '../lib/format';
import { Icon } from '../lib/icons';
import { AppTile, MonogramTile, StoreGlyph } from './AppMark';

export type InspectorTab = 'discover' | 'installed' | 'activity';

interface InspectorProps {
  state: AppState;
  actions: PhoneActions;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onPeek: (app: CatalogApp) => void;
}

function InstallButton({
  app,
  progress,
  installed,
  onGet,
  onOpen,
}: {
  app: CatalogApp;
  progress: InstallProgress | undefined;
  installed: boolean;
  onGet: () => void;
  onOpen: () => void;
}): ReactElement {
  const busy = progress && progress.phase !== 'done' && progress.phase !== 'failed';
  if (installed || progress?.phase === 'done') {
    return (
      <button type="button" className="get-btn is-open" onClick={onOpen} title={`Open ${app.name}`}>
        Open
      </button>
    );
  }
  if (busy) {
    const label =
      progress.phase === 'queued'
        ? 'On phone'
        : progress.phase === 'downloading'
          ? `${Math.max(4, Math.round(progress.progress * 100))}%`
          : 'Installing';
    return (
      <button
        type="button"
        className="get-btn is-progress"
        onClick={onGet}
        title={progress.message}
      >
        <span className="mini-spinner" />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`get-btn ${progress?.phase === 'failed' ? 'is-retry' : ''}`}
      onClick={onGet}
      title={`Get ${app.name} — opens the store on the phone`}
    >
      {progress?.phase === 'failed' ? 'Retry' : 'Get'}
    </button>
  );
}

export function Inspector({ state, actions, tab, onTab, onPeek }: InspectorProps): ReactElement {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const active = state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
  const platform = active?.platform ?? 'android';
  const installedIds = useMemo(
    () => new Set(state.installed.map((item) => item.appId).filter(Boolean)),
    [state.installed],
  );

  useEffect(() => {
    setQuery('');
    setCategory('All');
  }, [state.activeDeviceId]);

  const visibleApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.catalog.filter((app) => {
      const categoryOk = category === 'All' || app.category === category;
      if (!categoryOk) return false;
      if (!q) return true;
      return [app.name, app.publisher, app.category, app.tagline]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [state.catalog, query, category]);

  const pending = Object.values(state.installs).find(
    (progress) => progress.phase === 'queued' || progress.phase === 'downloading' || progress.phase === 'installing',
  );

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault();
    void actions.searchStore(query.trim());
  };

  const openInstalled = (packageId: string): void => {
    void actions.openApp(packageId);
  };

  const packageFor = (app: CatalogApp): string =>
    platform === 'ios' ? app.iosBundleId : app.androidPackage;

  return (
    <aside className="inspector">
      <div className="tabs" role="tablist" aria-label="Workspace panels">
        {(
          [
            ['discover', 'Discover'],
            ['installed', 'Installed'],
            ['activity', 'Activity'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => onTab(id)}
          >
            {label}
            {id === 'installed' ? (
              <span className="tab-count">{state.installed.length}</span>
            ) : id === 'activity' ? (
              <span className="tab-count">{state.activity.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'discover' ? (
        <div className="panel-body">
          <div className="store-head">
            <StoreGlyph platform={platform} size={34} />
            <div className="store-head-copy">
              <div className="eyebrow">{storeName(platform).toUpperCase()}</div>
              <h2>Discover</h2>
            </div>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => void actions.openStore()}
              title={`Open ${storeName(platform)} on the phone`}
              aria-label={`Open ${storeName(platform)} on the phone`}
            >
              <Icon name="arrow-up-right" size={15} />
            </button>
          </div>
          <p className="panel-sub">
            {active ? `Installing to ${active.name}` : 'Select a device to install'} · the real store
            handles the download.
          </p>

          <form className="search-box" onSubmit={submitSearch} role="search">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${storeName(platform)}…`}
              aria-label={`Search ${storeName(platform)}`}
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                }}
                aria-label="Clear search"
              >
                <Icon name="x" size={13} />
              </button>
            ) : (
              <span className="search-key">↵</span>
            )}
          </form>

          <div className="chips" role="tablist" aria-label="App categories">
            {APP_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={`chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {pending ? (
            <div className={`install-banner ${pending.phase === 'queued' ? 'is-waiting' : ''}`}>
              <span className="mini-spinner" />
              <div>
                <strong>
                  {pending.phase === 'queued'
                    ? 'Waiting for the store'
                    : pending.phase === 'downloading'
                      ? 'Downloading on the phone'
                      : 'Installing on the phone'}
                </strong>
                <span>{pending.message}</span>
              </div>
              <span className="install-banner-pct">
                {pending.phase === 'queued' ? '…' : `${Math.round(pending.progress * 100)}%`}
              </span>
            </div>
          ) : null}

          <div className="app-list">
            {visibleApps.length === 0 ? (
              <div className="empty-inline">
                <Icon name="search" size={18} />
                <p>No apps match “{query}”.</p>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void actions.searchStore(query.trim())}
                >
                  Search the real {storeName(platform)} instead
                </button>
              </div>
            ) : (
              visibleApps.map((app) => {
                const progress = state.installs[app.id];
                const installed = installedIds.has(app.id);
                return (
                  <div className="app-row" key={app.id}>
                    <button
                      type="button"
                      className="app-row-main"
                      onClick={() => onPeek(app)}
                      aria-label={`${app.name} details`}
                    >
                      <AppTile app={app} size={46} />
                      <span className="app-row-copy">
                        <span className="app-row-name">
                          {app.name}
                          {app.id === 'x' ? <span className="app-row-verified">·</span> : null}
                        </span>
                        <span className="app-row-meta">
                          {app.category}
                          <span className="dot-sep" />
                          <span className="star">★</span> {app.rating.toFixed(1)}
                          <span className="dot-sep" />
                          {app.installs}
                        </span>
                        <span className="app-row-tagline">{app.tagline}</span>
                      </span>
                    </button>
                    <div className="app-row-actions">
                      <InstallButton
                        app={app}
                        progress={progress}
                        installed={installed}
                        onGet={() => void actions.installApp(app.id)}
                        onOpen={() => openInstalled(packageFor(app))}
                      />
                      <button
                        type="button"
                        className="row-link"
                        onClick={() => void actions.openStore(app.id)}
                        title={`Open ${app.name} in ${storeName(platform)}`}
                        aria-label={`Open ${app.name} in ${storeName(platform)}`}
                      >
                        <Icon name="arrow-up-right" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="panel-note">
            <Icon name="info" size={14} />
            <p>
              {active?.isDemo
                ? 'Demo installs are simulated locally. On a real phone, PhoneExplorer opens the store and detects the package when it lands.'
                : `PhoneExplorer opens ${storeName(platform)} on the phone and watches the package list. It never asks for your store password.`}
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'installed' ? (
        <div className="panel-body">
          <div className="panel-head">
            <div>
              <div className="eyebrow">ON THE PHONE</div>
              <h2>
                {state.installed.length} app{state.installed.length === 1 ? '' : 's'}
              </h2>
            </div>
            <div className="row gap-6">
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => void actions.refresh()}
                title="Refresh app list"
                aria-label="Refresh app list"
              >
                <Icon name="refresh" size={15} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void actions.installFromFile()}
              >
                <Icon name="plus" size={14} />
                Install file
              </button>
            </div>
          </div>
          <p className="panel-sub">
            Launch anything installed, including system apps matched to the catalog.
          </p>

          {state.installed.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="grid" size={22} />
              </span>
              <h3>Nothing installed yet</h3>
              <p>Install something from Discover, then launch it here in one click.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTab('discover')}>
                Browse apps
              </button>
            </div>
          ) : (
            <div className="installed-grid">
              {state.installed.map((item) => {
                const app = item.appId
                  ? state.catalog.find((candidate) => candidate.id === item.appId)
                  : undefined;
                return (
                  <button
                    type="button"
                    key={item.packageId}
                    className="installed-app"
                    onClick={() => openInstalled(item.packageId)}
                    title={`${item.name}${item.system ? ' · system app' : ''}\n${item.packageId}`}
                  >
                    {app ? (
                      <AppTile app={app} size={56} />
                    ) : (
                      <MonogramTile name={item.name} size={56} tone="slate" />
                    )}
                    <span className="installed-name">{truncate(item.name, 14)}</span>
                    {item.system ? <span className="installed-tag">SYS</span> : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="panel-note">
            <Icon name="terminal" size={14} />
            <p>
              Sideload a signed <span className="mono">.apk</span> or{' '}
              <span className="mono">.ipa</span> with Install file. iOS installs also need a valid
              provisioning profile.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="panel-body">
          <div className="panel-head">
            <div>
              <div className="eyebrow">SESSION LOG</div>
              <h2>Activity</h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void actions.clearActivity()}
              disabled={state.activity.length === 0}
            >
              <Icon name="trash" size={13} />
              Clear
            </button>
          </div>
          <p className="panel-sub">Every bridge command, install and mirror event.</p>

          {state.activity.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="pulse" size={22} />
              </span>
              <h3>Quiet in here</h3>
              <p>Connect a phone or open the demo to start a session.</p>
            </div>
          ) : (
            <div className="activity-list">
              {state.activity.map((item) => (
                <div className={`activity-item tone-${levelTone(item.level)}`} key={item.id}>
                  <span className="activity-dot" />
                  <div className="activity-copy">
                    <div className="activity-message">{item.message}</div>
                    {item.detail ? <div className="activity-detail">{item.detail}</div> : null}
                    <div className="activity-time" title={clockTime(item.ts)}>
                      {clockTime(item.ts)} ·{' '}
                      {timeAgo(item.ts) === 'now' ? 'just now' : `${timeAgo(item.ts)} ago`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
