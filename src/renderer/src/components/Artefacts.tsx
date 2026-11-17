import { useEffect, useState, type ReactElement } from 'react';
import type { ArtefactDocument, ArtefactSection, Screenshot } from '@shared/types';
import type { PhoneActions } from '../hooks/usePhone';
import { Icon } from '../lib/icons';
import { Overlay } from './Modals';

interface ArtefactsProps {
  actions: PhoneActions;
  onRecord: () => void;
  onStop: () => void;
  recording: boolean;
  processing: boolean;
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

async function shrinkImage(dataUrl: string, width = 520): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, width / Math.max(1, image.width));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export function Artefacts({ actions, onRecord, onStop, recording, processing }: ArtefactsProps): ReactElement {
  const [doc, setDoc] = useState<ArtefactDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerShots, setPickerShots] = useState<Screenshot[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

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

  const openPicker = async (): Promise<void> => {
    const shots = await actions.listScreenshots();
    setPickerShots(shots);
    setSelected(new Set());
    setPickerOpen(true);
  };

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 24) next.add(id);
      return next;
    });
  };

  const createFromSelection = async (): Promise<void> => {
    const chosen = pickerShots
      .filter((shot) => selected.has(shot.id))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 24);
    if (chosen.length === 0) return;
    setCreating(true);
    try {
      const sections: ArtefactSection[] = [];
      for (const shot of chosen) {
        const raw = await actions.loadScreenshot(shot.id);
        if (!raw) continue;
        const boxes = await actions.ocrScreenshot(shot.id).catch(() => []);
        const title =
          boxes
            .map((box) => box.text.trim())
            .filter(
              (text) =>
                text.length >= 4 &&
                !/^\d|^\d{1,2}:\d{2}|a\.m\.|p\.m\.|baterie|wi-fi|notification|^[$€£]/i.test(text),
            )
            .sort((a, b) => b.length - a.length)[0]
            ?.slice(0, 60) ?? shot.caption?.slice(0, 60) ?? shot.deviceName ?? 'Library screenshot';
        sections.push({
          id: shot.id,
          title,
          description:
            shot.caption ||
            `Selected from the Library · ${new Date(shot.createdAt).toLocaleString()}`,
          image: await shrinkImage(raw),
        });
      }
      if (sections.length === 0) throw new Error('No screenshots could be loaded.');
      const saved = await actions.saveArtefact({
        title: `Selected screens · ${new Date().toLocaleDateString()}`,
        subtitle: `${sections.length} screenshots selected from the Library.`,
        deviceName: 'Screenshot Library',
        sections,
        quiet: true,
      });
      if (!saved) throw new Error('The artefact could not be saved.');
      setPickerOpen(false);
      await load();
      actions.toast('success', 'Artefact created', `${sections.length} selected screenshots`);
    } catch (error) {
      actions.toast(
        'error',
        'Could not create artefact',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setCreating(false);
    }
  };

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
        onClick={recording ? onStop : onRecord}
        disabled={processing}
      >
        {processing ? <span className="mini-spinner" /> : <Icon name="camera" size={15} />}
        {processing
          ? 'Extracting screenshots…'
          : recording
            ? 'Stop recording'
            : 'Record an artefact'}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm artefact-pick"
        onClick={() => void openPicker()}
        disabled={creating || recording || processing}
      >
        <Icon name="layers" size={14} />
        Create from screenshots
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
            Record an artefact: move through the phone yourself. PhoneExplorer records the video,
            captures screenshots every two seconds, then selects the distinct phone views and
            lays them out as a document here.
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

      {pickerOpen ? (
        <Overlay
          onClose={() => setPickerOpen(false)}
          label="Choose screenshots for an artefact"
          className="screenshot-picker"
        >
          <div className="picker-head">
            <div>
              <div className="eyebrow">ARTEFACT FROM LIBRARY</div>
              <h2>Choose screenshots</h2>
              <p>Select up to 24 phone views for the document, in any order.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setPickerOpen(false)} aria-label="Close picker">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="picker-actions">
            <span>{selected.size} selected · max 24</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSelected(
                  selected.size === pickerShots.length
                    ? new Set()
                    : new Set(pickerShots.map((shot) => shot.id)),
                )
              }
            >
              {selected.size === pickerShots.length ? 'Clear' : 'Select all'}
            </button>
          </div>
          <div className="picker-grid">
            {pickerShots.map((shot) => {
              const isSelected = selected.has(shot.id);
              return (
                <button
                  type="button"
                  key={shot.id}
                  className={`picker-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => toggle(shot.id)}
                  aria-pressed={isSelected}
                >
                  <img src={shot.thumbnail} alt="" />
                  <span className="picker-check">{isSelected ? '✓' : ''}</span>
                  <span className="picker-caption">
                    {shot.caption || shot.deviceName || shot.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="picker-foot">
            <span>{pickerShots.length} screenshots in Library</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void createFromSelection()}
              disabled={creating || selected.size === 0}
            >
              {creating ? <span className="mini-spinner" /> : <Icon name="layers" size={14} />}
              {creating ? 'Creating…' : `Create artefact · ${selected.size}`}
            </button>
          </div>
        </Overlay>
      ) : null}

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
