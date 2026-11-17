import { useEffect, useState, type ReactElement } from 'react';
import type { ArtefactDocument } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { Icon } from '../lib/icons';
import { Overlay } from './Modals';

interface ArtefactsProps {
  actions: PhoneActions;
  onWalkthrough: () => void;
  running: boolean;
}

function prettyFolder(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

function prettyDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Artefacts({ actions, onWalkthrough, running }: ArtefactsProps): ReactElement {
  const [doc, setDoc] = useState<ArtefactDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    setDoc(await actions.getArtefact());
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const onChanged = (): void => {
      void load();
    };
    window.addEventListener('phone:artefact', onChanged);
    return () => window.removeEventListener('phone:artefact', onChanged);
    // Actions only delegate to the preload bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const section = preview !== null ? doc?.sections[preview] ?? null : null;

  return (
    <div className="panel-body artefact-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">APP UNDERSTANDING</div>
          <h2>Artefacts</h2>
        </div>
        <div className="row gap-6">
          {doc ? (
            <>
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => void actions.revealArtefact()}
                title="Reveal Artefacts folder"
                aria-label="Reveal Artefacts folder"
              >
                <Icon name="folder" size={15} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void actions.openArtefact()}
              >
                <Icon name="external" size={13} />
                Open
              </button>
            </>
          ) : null}
        </div>
      </div>
      <p className="panel-sub">
        {doc
          ? `${doc.sections.length} views · ${prettyFolder(doc.folder)}`
          : 'Pages of every tab, overlay and decision captured in one pass.'}
      </p>

      <button
        type="button"
        className="btn btn-primary artefact-run"
        onClick={onWalkthrough}
        disabled={running}
      >
        {running ? <span className="mini-spinner" /> : <Icon name="camera" size={15} />}
        {running ? 'Capturing the app…' : doc ? 'Recapture walkthrough' : 'Capture walkthrough'}
      </button>

      {loading && !doc ? (
        <div className="artefact-loading">
          <span className="mini-spinner" />
          Loading document…
        </div>
      ) : !doc ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="layers" size={22} />
          </span>
          <h3>No artefact yet</h3>
          <p>
            Run the walkthrough: PhoneExplorer opens every tab and key overlay, saves each view
            to the Library, then lays them out as a short document here.
          </p>
        </div>
      ) : (
        <>
          <div className="artefact-summary">
            <span className="artefact-dot" />
            <strong>{doc.title}</strong>
            <span>{prettyDate(doc.createdAt)}</span>
          </div>
          <div className="artefact-sheet">
            <section className="artefact-cover">
              <span className="artefact-kicker">APP UNDERSTANDING · WALKTHROUGH</span>
              <h3>{doc.title}</h3>
              <p>{doc.subtitle}</p>
              <dl>
                <div>
                  <dt>Device</dt>
                  <dd>{doc.deviceName}</dd>
                </div>
                <div>
                  <dt>Views</dt>
                  <dd>{doc.sections.length}</dd>
                </div>
              </dl>
            </section>
            {doc.sections.map((item, index) => (
              <button
                type="button"
                className="artefact-page"
                key={item.id}
                onClick={() => setPreview(index)}
              >
                <div className="artefact-page-head">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>PHONEEXPLORER · ARTEFACTS</span>
                </div>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                <img src={item.image} alt={item.title} />
                <div className="artefact-page-foot">
                  <span>{doc.deviceName}</span>
                  <span>{index + 1} / {doc.sections.length}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {section ? (
        <Overlay onClose={() => setPreview(null)} label={`${section.title} page`} className="artefact-viewer">
          <div className="artefact-viewer-head">
            <div>
              <div className="eyebrow">ARTEFACT · {String((preview ?? 0) + 1).padStart(2, '0')}</div>
              <h2>{section.title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => setPreview(null)} aria-label="Close page">
              <Icon name="x" size={16} />
            </button>
          </div>
          <p className="artefact-viewer-copy">{section.description}</p>
          <img src={section.image} alt={section.title} />
          <div className="artefact-viewer-foot">
            <span>{doc?.deviceName}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPreview(null)}>
              Done
            </button>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
