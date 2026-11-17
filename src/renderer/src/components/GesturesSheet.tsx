import type { ReactElement } from 'react';
import type { AppState } from '@shared/types';
import { Icon, type IconName } from '../lib/icons';
import { Overlay } from './Modals';

interface GesturesSheetProps {
  state: AppState;
  onClose: () => void;
}

const GESTURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'smartphone',
    title: 'Click',
    body: 'A tap on the mirrored screen is a tap on the phone.',
  },
  {
    icon: 'arrow-right',
    title: 'Drag',
    body: 'Drag across the screen to swipe, scroll a list or move a slider.',
  },
  {
    icon: 'chevron-down',
    title: 'Wheel',
    body: 'Scroll the wheel, or press ↑/↓, to scroll the phone in the same direction.',
  },
  {
    icon: 'zoom-in',
    title: 'Pinch',
    body: 'Ctrl/⌘ + wheel, or the zoom buttons below the phone, send a two-finger pinch.',
  },
  {
    icon: 'clock',
    title: 'Hold',
    body: 'Press and hold for 620 ms to long-press or open a context menu.',
  },
  {
    icon: 'chevron-left',
    title: 'Right click',
    body: 'Right-click or the mouse Back button sends Back. Middle-click or Forward sends Home.',
  },
  {
    icon: 'arrow-right',
    title: 'Arrow keys',
    body: '←/→ swipe in that direction; ↑/↓ scroll. Ignored while you are typing.',
  },
  {
    icon: 'keyboard',
    title: 'Type',
    body: 'Open the keyboard button to send text to an Android phone.',
  },
  {
    icon: 'grid',
    title: 'Hardware',
    body: 'Back, Home, Recents, volume and power live in the pill under the phone.',
  },
];

export function GesturesSheet({ state, onClose }: GesturesSheetProps): ReactElement {
  const device = state.devices.find((candidate) => candidate.id === state.activeDeviceId);
  const multiTouch = device?.controlEngine === 'scrcpy';
  return (
    <Overlay onClose={onClose} className="modal-guide" label="Gesture guide">
      <header className="modal-head">
        <div>
          <div className="eyebrow">TOUCH, TRANSLATED</div>
          <h2>Control the phone</h2>
          <p>
            The mirror is an input surface. Click, drag, scroll and pinch are sent to the
            phone, or simulated in the demo.
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={17} />
        </button>
      </header>
      <div className="guide-grid">
        {GESTURES.map((gesture) => (
          <div className="guide-card" key={gesture.title}>
            <span className="guide-icon">
              <Icon name={gesture.icon} size={17} />
            </span>
            <div>
              <strong>{gesture.title}</strong>
              <p>{gesture.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={`guide-status ${multiTouch ? 'is-ready' : ''}`}>
        <span className={`status-dot ${multiTouch ? 'ok' : 'warn'}`} />
        <div>
          <strong>
            {multiTouch
              ? 'Multi-touch is ready on this phone'
              : device?.isDemo
                ? 'Demo gestures are simulated'
                : 'Single touch is active'}
          </strong>
          <span>
            {multiTouch
              ? 'scrcpy control channel · two-finger pinch enabled. Tap, drag, scroll and long-press use adb.'
              : device?.isDemo
                ? 'Demo pinch zooms the mirror; wheel and arrows change pages or scroll the store.'
                : device?.platform === 'ios'
                  ? 'The iPhone bridge injects single touch. Pinch needs a WebDriverAgent session.'
                  : 'Android pinch starts automatically through scrcpy. Tap, drag, scroll and long-press use adb.'}
          </span>
        </div>
      </div>
      <footer className="modal-foot">
        <span className="mono-label">TIP · CLICK THE PHONE, NOT THE WINDOW</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Got it
        </button>
      </footer>
    </Overlay>
  );
}
