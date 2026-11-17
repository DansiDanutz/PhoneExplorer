import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { APP_CATEGORIES } from '@shared/catalog';
import type { ActivityLevel, AppState, CatalogApp, InstallProgress } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { clockTime, levelTone, storeName, timeAgo, truncate } from '../lib/format';
import { Icon, type IconName } from '../lib/icons';
import { AppTile, MonogramTile, StoreGlyph } from './AppMark';
import { Library } from './Library';
import { Artefacts } from './Artefacts';

export type InspectorTab = 'discover' | 'installed' | 'activity' | 'library' | 'artefacts';

const TABS: Array<{ id: InspectorTab; label: string; icon: IconName; description: string }> = [
  {
    id: 'discover',
    label: 'Discover',
    icon: 'store',
    description: 'Catalog, search and category filters for the app store.',
  },
  {
    id: 'installed',
    label: 'Installed',
    icon: 'grid',
    description: 'Installed packages and launch controls read from the phone.',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: 'pulse',
    description: 'Chronological bridge and install activity log.',
  },
  {
    id: 'library',
    label: 'Library',
    icon: 'camera',
    description: 'Screenshots captured from the phone and from walkthroughs.',
  },
  {
    id: 'artefacts',
    label: 'Artefacts',
    icon: 'layers',
    description: 'Generated Pages-style app-understanding documents.',
  },
];

function Panel({ id, children }: { id: InspectorTab; children: ReactNode }): ReactElement {
  return (
    <div
      className="tabpanel"
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function activityIcon(level: ActivityLevel): IconName {
  switch (level) {
    case 'success':
      return 'check';
    case 'error':
    case 'warn':
      return 'alert';
    case 'device':
      return 'smartphone';
    default:
      return 'info';
  }
}

interface InspectorProps {
  state: AppState;
  actions: PhoneActions;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onPeek: (app: CatalogApp) => void;
  onRecord: () => void;
  onStop: () => void;
  recording: boolean;
  recordingProcessing: boolean;
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
      <button
        type="button"
        className="get-btn is-open"
        onClick={onOpen}
        title={`Open ${app.name}`}
        aria-label={`Open ${app.name}`}
      >
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
        aria-label={`Installing ${app.name}`}
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
      aria-label={`Install ${app.name}`}
    >
      {progress?.phase === 'failed' ? 'Retry' : 'Get'}
    </button>
  );
}

export function Inspector({
  state,
  actions,
  tab,
  onTab,
  onPeek,
  onRecord,
  onStop,
  recording,
  recordingProcessing,
}: InspectorProps): ReactElement {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  const countFor = (id: InspectorTab): number | null =>
    id === 'installed' ? state.installed.length : id === 'activity' ? state.activity.length : null;

  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    onTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className="inspector">
      <div className="tabs" role="tablist" aria-label="Workspace panels" aria-orientation="horizontal">
        {TABS.map((entry, index) => {
          const count = countFor(entry.id);
          return (
            <button
              key={entry.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-label={count !== null && count > 0 ? `${entry.label}, ${count}` : entry.label}
              aria-selected={tab === entry.id}
              aria-controls={`panel-${entry.id}`}
              tabIndex={tab === entry.id ? 0 : -1}
              className={`tab ${tab === entry.id ? 'is-active' : ''}`}
              onClick={() => onTab(entry.id)}
              onKeyDown={(event) => moveTab(event, index)}
              data-artefact-id={`tab-${entry.id}`}
              data-artefact-label={entry.label}
              data-artefact-kind="tab"
              data-artefact-description={entry.description}
            >
              <span className="tab-icon" aria-hidden="true">
                <Icon name={entry.icon} size={15} />
              </span>
              <span className="tab-meta">
                <span className="tab-label">{entry.label}</span>
                {count !== null && count > 0 ? <span className="tab-count">{count}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'discover' ? (
        <Panel id="discover">
          <div className="panel-body">
            <div className="store-head">
              <StoreGlyph platform={platform} size={36} />
              <div className="store-head-copy">
                <div className="eyebrow">{storeName(platform).toUpperCase()}</div>
                <h2>
                  Discover
                  <span className="head-count">{visibleApps.length}</span>
                </h2>
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
              {active ? `Installing to ${active.name}` : 'Select a device to install'} · the real
              store handles the download.
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
                <kbd className="search-key">⌘K</kbd>
              )}
            </form>

            <div className="chips" role="group" aria-label="Filter apps by category">
              {APP_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${category === item ? 'is-active' : ''}`}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="list-bar">
              <span>
                {visibleApps.length} app{visibleApps.length === 1 ? '' : 's'}
                {category !== 'All' ? ` · ${category}` : ''}
              </span>
              {category !== 'All' || query ? (
                <button
                  type="button"
                  className="list-bar-action"
                  onClick={() => {
                    setQuery('');
                    setCategory('All');
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <span className="list-bar-hint">Curated picks</span>
              )}
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
                  <span className="empty-icon">
                    <Icon name="search" size={20} />
                  </span>
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
                        aria-label={`${app.name} details, ${app.category}, rated ${app.rating.toFixed(1)}`}
                      >
                        <AppTile app={app} size={44} />
                        <span className="app-row-copy">
                          <span className="app-row-name">
                            {app.name}
                            {app.id === 'x' ? (
                              <span className="app-row-verified" title="Verified publisher">
                                <Icon name="check" size={11} />
                              </span>
                            ) : null}
                          </span>
                          <span className="app-row-meta">
                            {app.category}
                            <span className="dot-sep" />
                            <span className="app-row-rating">
                              <Icon name="star" size={9} />
                              {app.rating.toFixed(1)}
                            </span>
                            <span className="app-row-installs">
                              <span className="dot-sep" />
                              {app.installs}
                            </span>
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
        </Panel>
      ) : null}

      {tab === 'installed' ? (
        <Panel id="installed">
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
              <div className="empty-state is-card">
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
                      aria-label={`Open ${item.name}${item.system ? ', system app' : ''}`}
                      title={`${item.name}${item.system ? ' · system app' : ''}\n${item.packageId}`}
                    >
                      {app ? (
                        <AppTile app={app} size={48} />
                      ) : (
                        <MonogramTile name={item.name} size={48} tone="slate" />
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
        </Panel>
      ) : null}

      {tab === 'library' ? (
        <Panel id="library">
          <Library actions={actions} onDiscover={() => onTab('discover')} />
        </Panel>
      ) : null}

      {tab === 'artefacts' ? (
        <Panel id="artefacts">
          <Artefacts
            actions={actions}
            onRecord={onRecord}
            onStop={onStop}
            recording={recording}
            processing={recordingProcessing}
          />
        </Panel>
      ) : null}

      {tab === 'activity' ? (
        <Panel id="activity">
          <div className="panel-body">
            <div className="panel-head">
              <div>
                <div className="eyebrow">SESSION LOG</div>
                <h2>
                  Activity
                  {state.activity.length > 0 ? (
                    <span className="head-count">{state.activity.length}</span>
                  ) : null}
                </h2>
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
              <div className="empty-state is-card">
                <span className="empty-icon">
                  <Icon name="pulse" size={22} />
                </span>
                <h3>Quiet in here</h3>
                <p>Connect a phone or open the demo to start a session.</p>
              </div>
            ) : (
              <div className="activity-card">
                {state.activity.map((item) => (
                  <div className={`activity-item tone-${levelTone(item.level)}`} key={item.id}>
                    <span className="activity-icon" aria-hidden="true">
                      <Icon name={activityIcon(item.level)} size={12} />
                    </span>
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
        </Panel>
      ) : null}
    </aside>
  );
}
