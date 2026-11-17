import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import type { DeviceInfo, FramePayload, KeyAction, ScreenshotRequest } from '@shared/types';
import { shade } from '../lib/format';
import { Icon } from '../lib/icons';

interface PhoneFrameProps {
  device: DeviceInfo;
  frame: FramePayload | null;
  previewActive: boolean;
  onTap: (x: number, y: number) => void;
  onLongPress: (x: number, y: number) => void;
  onSwipe: (x1: number, y1: number, x2: number, y2: number) => void;
  onScroll: (x: number, y: number, deltaX: number, deltaY: number) => void;
  onPinch: (x: number, y: number, scale: number) => void;
  onPress: (key: KeyAction) => void;
  onCaptureScreenshot: (request: ScreenshotRequest) => void;
  onStartPreview: () => void;
}

interface ImagePoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

function frameUrl(frame: FramePayload): string {
  return frame.mime === 'image/svg+xml'
    ? frame.data
    : `data:${frame.mime};base64,${frame.data}`;
}

/**
 * Map a pointer to the image content inside the screen. Screenshots are
 * letterboxed by object-fit: contain, so the black bars must not shift taps.
 */
function mapImagePoint(
  rect: DOMRect,
  frame: FramePayload | null,
  clientX: number,
  clientY: number,
): ImagePoint | null {
  if (rect.width === 0 || rect.height === 0) return null;
  const imageAspect = (frame?.width ?? 402) / (frame?.height ?? 874);
  const boxAspect = rect.width / rect.height;
  let drawWidth = rect.width;
  let drawHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;
  if (imageAspect > boxAspect) {
    drawHeight = rect.width / imageAspect;
    offsetY = (rect.height - drawHeight) / 2;
  } else {
    drawWidth = rect.height * imageAspect;
    offsetX = (rect.width - drawWidth) / 2;
  }
  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;
  if (localX < 0 || localY < 0 || localX > drawWidth || localY > drawHeight) return null;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    nx: localX / drawWidth,
    ny: localY / drawHeight,
  };
}

export function PhoneFrame({
  device,
  frame,
  previewActive,
  onTap,
  onLongPress,
  onSwipe,
  onScroll,
  onPinch,
  onPress,
  onCaptureScreenshot,
  onStartPreview,
}: PhoneFrameProps): ReactElement {
  const screenRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; nx: number; ny: number } | null>(null);
  const frameRef = useRef(frame);
  const callbacksRef = useRef({ onScroll, onPinch, onLongPress, onPress });
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const lastInputAt = useRef(0);
  const movedDuringPress = useRef(false);
  const captureRef = useRef<() => Promise<void>>(async () => undefined);
  const scrollAccum = useRef({
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    timer: null as number | null,
  });
  const pinchAccum = useRef({
    x: 0.5,
    y: 0.5,
    scale: 1,
    timer: null as number | null,
  });
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  frameRef.current = frame;
  callbacksRef.current = { onScroll, onPinch, onLongPress, onPress };

  const point = (clientX: number, clientY: number): ImagePoint | null => {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return mapImagePoint(rect, frameRef.current, clientX, clientY);
  };

  const clearLongPress = (): void => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPress(), []);

  // Wheel is registered natively so trackpad pinch (ctrl+wheel) can call
  // preventDefault instead of zooming the Electron page.
  useEffect(() => {
    const element = screenRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      const rect = element.getBoundingClientRect();
      const p = mapImagePoint(rect, frameRef.current, event.clientX, event.clientY);
      if (!p) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const accum = pinchAccum.current;
        accum.x = p.nx;
        accum.y = p.ny;
        accum.scale *= Math.exp(-event.deltaY * 0.0025);
        // A pinch is one discrete two-pointer gesture; send it after the
        // trackpad stream settles rather than interleaving gestures.
        if (accum.timer) window.clearTimeout(accum.timer);
        accum.timer = window.setTimeout(() => {
          const scale = Math.max(0.5, Math.min(2, accum.scale));
          accum.scale = 1;
          accum.timer = null;
          callbacksRef.current.onPinch(accum.x, accum.y, scale);
        }, 90);
        return;
      }
      const accum = scrollAccum.current;
      accum.x = p.nx;
      accum.y = p.ny;
      accum.deltaX += event.deltaX;
      accum.deltaY += event.deltaY;
      if (!accum.timer) {
        accum.timer = window.setTimeout(() => {
          const { x, y, deltaX, deltaY } = accum;
          accum.deltaX = 0;
          accum.deltaY = 0;
          accum.timer = null;
          if (Math.abs(deltaX) + Math.abs(deltaY) > 0) {
            callbacksRef.current.onScroll(x, y, deltaX, deltaY);
          }
        }, 80);
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      if (scrollAccum.current.timer) window.clearTimeout(scrollAccum.current.timer);
      if (pinchAccum.current.timer) window.clearTimeout(pinchAccum.current.timer);
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button === 3) {
      event.preventDefault();
      callbacksRef.current.onPress('back');
      return;
    }
    if (event.button === 4) {
      event.preventDefault();
      callbacksRef.current.onPress('home');
      return;
    }
    if (event.button !== 0) return;
    screenRef.current?.focus({ preventScroll: true });
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    startRef.current = { x: p.x, y: p.y, nx: p.nx, ny: p.ny };
    longFired.current = false;
    movedDuringPress.current = false;
    clearLongPress();
    longTimer.current = window.setTimeout(() => {
      const start = startRef.current;
      if (!start) return;
      longFired.current = true;
      lastInputAt.current = Date.now();
      setRipple({ x: start.x, y: start.y, id: Date.now() });
      window.setTimeout(() => setRipple(null), 620);
      callbacksRef.current.onLongPress(start.nx, start.ny);
    }, 620);
    screenRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const start = startRef.current;
    if (!start) return;
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    if (Math.hypot(p.x - start.x, p.y - start.y) > 10) clearLongPress();
    if (Math.hypot(p.x - start.x, p.y - start.y) > 22) movedDuringPress.current = true;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    clearLongPress();
    const start = startRef.current;
    startRef.current = null;
    setDragging(false);
    if (!start) return;
    if (longFired.current) {
      longFired.current = false;
      lastInputAt.current = Date.now();
      return;
    }
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    lastInputAt.current = Date.now();
    if (Math.hypot(dx, dy) > 22) {
      onSwipe(start.nx, start.ny, p.nx, p.ny);
    } else {
      setRipple({ x: p.x, y: p.y, id: Date.now() });
      window.setTimeout(() => setRipple(null), 620);
      onTap(p.nx, p.ny);
    }
  };

  // Safety net: if a pointerup is lost (window focus changes, a child is
  // replaced mid-press), the click still reaches the phone. Normal pointerups
  // stamp lastInputAt so this does not double-fire.
  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    if (movedDuringPress.current) return;
    if (Date.now() - lastInputAt.current < 450) return;
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    lastInputAt.current = Date.now();
    setRipple({ x: p.x, y: p.y, id: Date.now() });
    window.setTimeout(() => setRipple(null), 620);
    onTap(p.nx, p.ny);
  };

  const handlePointerCancel = (): void => {
    clearLongPress();
    startRef.current = null;
    longFired.current = false;
    setDragging(false);
  };

  const hotspotTap = (h: NonNullable<FramePayload['hotspots']>[number]): void => {
    onTap((h.x + h.w / 2) / (frame?.width ?? 402), (h.y + h.h / 2) / (frame?.height ?? 874));
  };

  const capture = async (): Promise<void> => {
    const current = frameRef.current;
    if (current && current.width > 0 && current.height > 0) {
      try {
        const image = new Image();
        image.src = frameUrl(current);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = current.width;
        canvas.height = current.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, current.width, current.height);
        onCaptureScreenshot({ dataUrl: canvas.toDataURL('image/png') });
        return;
      } catch {
        // Fall back to the visible window rect if the frame cannot be
        // rasterized (for example a malformed remote image).
      }
    }
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;
    onCaptureScreenshot({
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  captureRef.current = capture;

  useEffect(() => {
    const onRequest = (): void => {
      void captureRef.current();
    };
    window.addEventListener('phone:capture-screenshot', onRequest);
    return () => window.removeEventListener('phone:capture-screenshot', onRequest);
  }, []);

  const statusMessage = !previewActive
    ? 'Preview is paused'
    : 'Waiting for the first frame';
  const frameColor = device.frameColor;
  const shellStyle = frameColor
    ? {
        background: `linear-gradient(145deg, ${shade(frameColor, 58)} 0%, ${shade(
          frameColor,
          12,
        )} 14%, ${shade(frameColor, -48)} 42%, ${frameColor} 55%, ${shade(
          frameColor,
          18,
        )} 76%, ${shade(frameColor, 64)} 100%)`,
      }
    : undefined;

  return (
    <div className="phone-wrap">
      <div
        className={`phone-shell ${dragging ? 'is-dragging' : ''}`}
        data-platform={device.platform}
        data-model={device.modelId ?? undefined}
        style={shellStyle}
      >
        <span className="phone-side phone-side--mute" aria-hidden="true" />
        <button
          type="button"
          className="phone-side phone-side--vol-up"
          onClick={() => onPress('volume_up')}
          title="Volume up"
          aria-label="Volume up"
        />
        <button
          type="button"
          className="phone-side phone-side--vol-down"
          onClick={() => onPress('volume_down')}
          title="Volume down"
          aria-label="Volume down"
        />
        <button
          type="button"
          className="phone-side phone-side--power"
          onClick={() => onPress('power')}
          title="Power"
          aria-label="Power"
        />
        <button
          type="button"
          className="phone-side phone-side--shot"
          onClick={() => void capture()}
          title="Save a screenshot"
          aria-label="Save a screenshot"
        >
          <Icon name="camera" size={14} />
        </button>
        <div className="phone-bezel">
          <div
            className="phone-screen"
            ref={screenRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={handleClick}
            onContextMenu={(event) => {
              event.preventDefault();
              callbacksRef.current.onPress('back');
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                callbacksRef.current.onPress('home');
              } else if (event.button === 3 || event.button === 4) {
                // The pointerdown handler already sent Back/Home; just stop
                // Chromium's default history navigation.
                event.preventDefault();
              }
            }}
            role="application"
            aria-label={`${device.name} live screen`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            title="Click to tap · drag to swipe · wheel or ↑/↓ to scroll · ←/→ to swipe · Ctrl/⌘-wheel to pinch · right-click for Back"
            tabIndex={0}
          >
            {frame ? (
              <img
                className="phone-image"
                src={frameUrl(frame)}
                alt={`${device.name} screen`}
                draggable={false}
              />
            ) : (
              <div className="phone-placeholder">
                <span className={`placeholder-pulse ${previewActive ? 'is-on' : ''}`}>
                  <Icon name={previewActive ? 'pulse' : 'monitor'} size={26} />
                </span>
                <p className="placeholder-title">{statusMessage}</p>
                <p className="placeholder-copy">
                  {device.status === 'unauthorized'
                    ? 'Unlock the phone and tap “Allow” on the USB debugging prompt.'
                    : device.hint ?? 'Frames are captured straight from the device.'}
                </p>
                {!previewActive && device.capabilities.mirror ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onStartPreview}>
                    Start preview
                  </button>
                ) : null}
              </div>
            )}

            {frame && frame.hotspots?.length
              ? frame.hotspots.map((hotspot, index) => (
                  <button
                    key={`${hotspot.action}-${hotspot.value}-${index}`}
                    type="button"
                    className="hotspot"
                    style={{
                      left: `${(hotspot.x / (frame.width || 1)) * 100}%`,
                      top: `${(hotspot.y / (frame.height || 1)) * 100}%`,
                      width: `${(hotspot.w / (frame.width || 1)) * 100}%`,
                      height: `${(hotspot.h / (frame.height || 1)) * 100}%`,
                    }}
                    data-label={hotspot.label}
                    aria-label={hotspot.label}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={() => hotspotTap(hotspot)}
                  />
                ))
              : null}

            {ripple ? (
              <span
                key={ripple.id}
                className="tap-ripple"
                style={{ left: ripple.x, top: ripple.y }}
                aria-hidden="true"
              />
            ) : null}
            <span className="screen-glare" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
