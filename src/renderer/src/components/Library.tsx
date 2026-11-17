import { useEffect, useState, type ReactElement } from 'react';
import type { Screenshot } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { Icon } from '../lib/icons';
import { Overlay } from './Modals';

interface LibraryProps {
  actions: PhoneActions;
  onDiscover: () => void;
}

function shotDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Library({ actions, onDiscover }: LibraryProps): ReactElement {
  const [items, setItems] = useState<Screenshot[] | null>(null);
  const [viewer, setViewer] = useState<Screenshot | null>(null);
  const [fullImage, setFullImage] = useState('');
  const [folder, setFolder] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    const [next, dir] = await Promise.all([
      actions.listScreenshots(),
      actions.getScreenshotsFolder(),
    ]);
    setItems(next);
    setFolder(dir);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const onChanged = (): void => {
      void load();
    };
    window.addEventListener('phone:screenshot', onChanged);
    return () => window.removeEventListener('phone:screenshot', onChanged);
    // The action object is stable enough for this panel; it only delegates to
    // the preload bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (shot: Screenshot): Promise<void> => {
    setViewer(shot);
    setFullImage('');
    const image = await actions.loadScreenshot(shot.id);
    if (image) setFullImage(image);
  };

  const remove = async (): Promise<void> => {
    if (!viewer) return;
    if (!window.confirm(`Delete ${viewer.name}?`)) return;
    await actions.deleteScreenshot(viewer.id);
    setViewer(null);
    setFullImage('');
    await load();
  };

  return (
    <div className="panel-body">
      <div className="panel-head">
        <div>
          <div className="eyebrow">SCREEN LIBRARY</div>
          <h2>Screenshots</h2>
        </div>
        <div className="row gap-6">
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => void load()}
            title="Refresh screenshots"
            aria-label="Refresh screenshots"
            disabled={loading}
          >
            <Icon name="refresh" size={15} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void actions.revealScreenshotsFolder()}
          >
            <Icon name="folder" size={14} />
            Folder
          </button>
        </div>
      </div>
      <p className="panel-sub">
        {items?.length ?? 0} saved ·{' '}
        <span className="mono" title={folder || undefined}>
          {folder ? folder.replace(/^\/Users\/[^/]+/, '~') : '~/Pictures/PhoneExplorer'}
        </span>
      </p>

      {items === null || (loading && items.length === 0) ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="camera" size={22} />
          </span>
          <h3>Opening the library…</h3>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="camera" size={22} />
          </span>
          <h3>No screenshots yet</h3>
          <p>
            Click the camera button on the phone’s right margin, or press <span className="mono">⌘S</span>.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscover}>
            Open Discover
          </button>
        </div>
      ) : (
        <div className="shot-grid">
          {items.map((shot) => (
            <button
              type="button"
              className="shot-card"
              key={shot.id}
              onClick={() => void open(shot)}
              title={`${shot.name}\n${shot.path}`}
            >
              <span className="shot-thumb">
                <img src={shot.thumbnail} alt={`Screenshot of ${shot.deviceName}`} />
              </span>
              <span className="shot-copy">
                <strong>{shot.deviceName}</strong>
                <span>
                  {shotDate(shot.createdAt)} · {shot.width}×{shot.height}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {viewer ? (
        <Overlay
          className="modal-shot"
          label="Screenshot preview"
          onClose={() => {
            setViewer(null);
            setFullImage('');
          }}
        >
          <header className="modal-head">
            <div>
              <div className="eyebrow">CAPTURED SCREEN</div>
              <h2>{viewer.deviceName}</h2>
              <p>
                {shotDate(viewer.createdAt)} · {viewer.width}×{viewer.height}
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setViewer(null);
                setFullImage('');
              }}
              aria-label="Close"
            >
              <Icon name="x" size={17} />
            </button>
          </header>
          <div className="shot-view">
            <img src={fullImage || viewer.thumbnail} alt={`Screenshot of ${viewer.deviceName}`} />
          </div>
          <footer className="modal-foot shot-foot">
            <span className="mono shot-path" title={viewer.path}>
              {viewer.path}
            </span>
            <div className="row gap-8">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void actions.revealScreenshot(viewer.id)}
              >
                <Icon name="folder" size={14} />
                Reveal
              </button>
              <button type="button" className="btn btn-ghost btn-sm is-danger" onClick={() => void remove()}>
                <Icon name="trash" size={14} />
                Delete
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setViewer(null);
                  setFullImage('');
                }}
              >
                Done
              </button>
            </div>
          </footer>
        </Overlay>
      ) : null}
    </div>
  );
}
