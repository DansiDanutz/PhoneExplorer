import { useRef, useState, type PointerEvent, type ReactElement } from 'react';
import type { DeviceInfo, FramePayload } from '@shared/types';
import { Icon } from '../lib/icons';

interface PhoneFrameProps {
  device: DeviceInfo;
  frame: FramePayload | null;
  previewActive: boolean;
  onTap: (x: number, y: number) => void;
  onSwipe: (x1: number, y1: number, x2: number, y2: number) => void;
  onStartPreview: () => void;
}

function frameUrl(frame: FramePayload): string {
  return frame.mime === 'image/svg+xml'
    ? frame.data
    : `data:${frame.mime};base64,${frame.data}`;
}

export function PhoneFrame({
  device,
  frame,
  previewActive,
  onTap,
  onSwipe,
  onStartPreview,
}: PhoneFrameProps): ReactElement {
  const screenRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; nx: number; ny: number } | null>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const point = (clientX: number, clientY: number) => {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    // The screenshot is letterboxed by object-fit: contain. Map the pointer to
    // the image content, not the black bars around it.
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
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    startRef.current = { x: p.x, y: p.y, nx: p.nx, ny: p.ny };
    screenRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = startRef.current;
    startRef.current = null;
    setDragging(false);
    if (!start) return;
    const p = point(event.clientX, event.clientY);
    if (!p) return;
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (Math.hypot(dx, dy) > 22) {
      onSwipe(start.nx, start.ny, p.nx, p.ny);
    } else {
      setRipple({ x: p.x, y: p.y, id: Date.now() });
      window.setTimeout(() => setRipple(null), 620);
      onTap(p.nx, p.ny);
    }
  };

  const handlePointerCancel = (): void => {
    startRef.current = null;
    setDragging(false);
  };

  const hotspotTap = (h: NonNullable<FramePayload['hotspots']>[number]): void => {
    onTap((h.x + h.w / 2) / (frame?.width ?? 402), (h.y + h.h / 2) / (frame?.height ?? 874));
  };

  const statusMessage = !previewActive
    ? 'Preview is paused'
    : 'Waiting for the first frame';

  return (
    <div className="phone-wrap">
      <div className={`phone-shell ${dragging ? 'is-dragging' : ''}`} data-platform={device.platform}>
        <span className="phone-side phone-side--mute" aria-hidden="true" />
        <span className="phone-side phone-side--vol-up" aria-hidden="true" />
        <span className="phone-side phone-side--vol-down" aria-hidden="true" />
        <span className="phone-side phone-side--power" aria-hidden="true" />
        <div className="phone-bezel">
          <div
            className="phone-screen"
            ref={screenRef}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            role="application"
            aria-label={`${device.name} live screen`}
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
