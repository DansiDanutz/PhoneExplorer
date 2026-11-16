# Architecture

This document describes Stage 01 as shipped. It is intentionally small: one Electron
main process, one renderer, three device adapters, and a typed boundary between them.

## Goals

- Put a real Android or iPhone screen on the desktop.
- Open the **real** store listing and make the install → launch loop one click.
- Never hold store credentials, scrape a store, or fake an install on a real device.
- Work with no phone attached through an interactive demo.
- Keep the bridge inspectable: every command and failure lands in Activity.

Non-goals for this stage: audio, 60 fps video, file browsing, remote keyboards over the
network, or store automation.

## Process model

```
┌────────────────────────────── main process ──────────────────────────────┐
│  index.ts                                                               │
│   ├─ BrowserWindow (contextIsolation, sandbox, no nodeIntegration)       │
│   ├─ Menu / shortcuts / external-link handler                           │
│   ├─ CLI harness: --screenshot, --demo                                  │
│   └─ DeviceManager ────────────────────────────────────────────────┐    │
│        ├─ AdbClient ──────────── adb (USB / Wi-Fi)                │    │
│        ├─ IosBridge ──────────── idb / libimobiledevice / devicectl│    │
│        ├─ DemoDevice × 2 ─────── SVG screen engine                 │    │
│        ├─ preview engine ─────── screenshots → JPEG → IPC          │    │
│        ├─ install watcher ────── package / bundle polling          │    │
│        └─ settings.json ──────── fps, quality, paths, demo default │    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ contextBridge (typed)
┌───────────────────────────────────▼────────────────────────────────────┐
│  preload/index.ts  — window.phone                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ ipcRenderer.invoke / events
┌───────────────────────────────────▼────────────────────────────────────┐
│  React renderer                                                        │
│   DeviceRail · Stage/PhoneFrame · Inspector (Discover/Installed/Log)   │
│   Modals: Connect, Settings, AppSheet, QR · Toasts                     │
└────────────────────────────────────────────────────────────────────────┘
```

The renderer has **no** Node access. Everything it can do is an explicit method on
`PhoneAPI` in `src/shared/types.ts`, implemented by IPC handlers in
`src/main/index.ts` and forwarded to `DeviceManager`.

## Device adapters

### Android — `AdbClient`

| Concern | Command |
| --- | --- |
| Discovery | `adb devices -l` |
| Details | `adb -s S shell getprop`, `wm size`, `dumpsys battery` |
| Installed | `pm list packages`, `pm list packages -3` |
| Screenshot | `adb -s S exec-out screencap -p` (fallback: screencap + pull) |
| Input | `input tap`, `input swipe`, `input keyevent`, `input text` |
| Store | `am start -a android.intent.action.VIEW -d market://…` |
| Launch | `monkey -p pkg -c android.intent.category.LAUNCHER 1` |
| Sideload | `adb install -r -g file.apk` |

`adb` is resolved from the persisted custom path, `$ANDROID_HOME`, common SDK locations,
Homebrew, then `PATH`. The client is re-resolved after settings load; this is a subtle but
real bug the fake-adb test caught.

Screenshots are decoded with Electron's `nativeImage`, resized to 720 px wide, and encoded
to JPEG (quality from Settings). The original pixel size is kept for coordinate mapping.

### iPhone — `IosBridge`

Capabilities are probed independently, so the UI can degrade gracefully:

| Concern | First choice | Fallbacks |
| --- | --- | --- |
| Discovery | `idb list-targets --json` | `idevice_id -l` + `ideviceinfo`, `devicectl list devices` |
| Screenshot | `idb screenshot` | `idevicescreenshot` → `sips` TIFF→PNG |
| Apps | `idb list-apps --json` | `ideviceinstaller -l` |
| Store URL | `idb open-url` | QR handoff (no automation) |
| Launch | `idb launch` | `devicectl device process launch` |
| Touch | `idb ui tap/swipe` | view-only |
| Sideload | `ideviceinstaller -i` | `devicectl device install app` |

The `DeviceInfo.capabilities` object is derived from those probes and drives the UI. For
example, the mirror shows a "view only" footer when touch is unavailable, and the store
button falls back to QR when URL opening is unavailable.

iOS screenshots are 3× Retina. The first frame establishes a point size
(`width / 3`) used for `idb ui` coordinates; Android uses `wm size` (or the override size).
If the frame is landscape and the reported size portrait, the mapping swaps axes.

## Preview engine

A single 120 ms tick drives everything:

```
tick()
 ├─ demo active?
 │   ├─ demo.tick(now)            install progress, clock, state changes
 │   ├─ emit install progress     throttled by 0.8 %
 │   ├─ complete install?         refresh apps, toast, activity
 │   └─ preview active?           render SVG → force on heartbeat (1 s) / progress (150 ms)
 └─ real device + preview active?
     └─ if now-lastFrame >= 1000/fps and not busy → captureReal()
```

`captureReal` is guarded by a busy flag, so a slow phone cannot queue up screenshots. On
failure it backs off one interval; after four consecutive failures it stops the preview
and surfaces the error in Activity and the toast. Frame payloads carry the device size and
a sequence number; the renderer gates them by `deviceId` so a late frame cannot appear on
a newly selected device.

**Why screenshots?** It is dependency-free, works on every Android 4.4+ / iOS version the
bridge supports, and is enough to judge UI. The cost is latency and CPU. Stage 02 replaces
it with scrcpy's H.264 stream decoded by WebCodecs (see RESEARCH.md).

### Coordinates

The renderer sends **normalized** pointer coordinates (0–1). `DeviceManager.toDevicePoint`
maps them to the device's pixel space, handling:

- demo: fixed 402 × 874;
- Android: `wm size` (override or physical);
- iPhone: derived point size (`frame / 3`);
- rotation: swap axes when the frame is landscape but the reported size is portrait.

This kept the renderer completely platform-agnostic: it only knows how big the image is.

## Input and gestures

The renderer is an input surface, not just a video view:

| Gesture | Renderer event | Android | iPhone |
| --- | --- | --- | --- |
| Tap | pointer down/up | scrcpy control or `adb input tap` | `idb ui tap` |
| Drag / swipe | pointer drag | scrcpy multi-point or `adb input swipe` | `idb ui swipe` |
| Scroll | wheel | scrcpy `injectScroll`, else directional swipe | directional swipe |
| Long press | 620 ms hold | scrcpy down/wait/up, else same-point swipe | same-point swipe |
| Pinch | Ctrl/⌘+wheel or buttons | scrcpy two-pointer gesture | not available (single touch) |
| Back | right-click | `adb keyevent 4` | left-edge system gesture |
| Home | middle-click / button | `adb keyevent 3` | bottom-edge system gesture |

The `ScrcpyControl` service keeps a **control-only** scrcpy session for the active Android
device. It pushes the vendored `scrcpy-server` (3.3.3) to `/data/local/tmp`, starts it with
`video=false audio=false control=true`, and writes touch/scroll messages through
`ScrcpyControlMessageWriter`. Video still comes from the screenshot engine. The session
starts in the background when an Android device is selected; until it is ready (or if it
fails) gestures use the adb fallbacks. The control engine is shown in the stage footer and
the connection card.

The pinch sequence uses two pointer IDs. The first `ACTION_DOWN` creates the primary
pointer; the second is sent as `ACTION_DOWN` too because scrcpy converts it to
`ACTION_POINTER_DOWN | (index << SHIFT)` and the matching `ACTION_UP` to `ACTION_POINTER_UP`.
Fingers are moved in 14 steps, then released in reverse order. Scroll is inverted from the
browser's `deltaY` to Android's `AXIS_VSCROLL` convention.

## Install tracking

Real devices cannot be installed onto programmatically through the store, so the flow is a
small state machine:

```
       Get
        │
        ▼
  queued (real) ── poll package list every 1.6 s ──► done
        │                                   │
        │ 5 min                             └─ toast + Activity + Open button
        ▼
     failed (retry available)
```

- On **Android** the watcher runs `pm list packages` and looks for the catalog's package.
- On **iPhone** it runs `idb list-apps` and looks for the bundle id.
- The periodic installed-app refresh (6 s) also completes the install if the watcher was
  not running.
- Demo installs skip the watcher and emit deterministic progress over ~3.4 s.
- The right-panel button and the phone mirror both derive from the same `installs` map, so
  they flip together.

The user-facing copy is explicit: "Finish the install on your phone." PhoneExplorer never
pretends to have installed something it did not.

## Demo engine

`DemoDevice` is a deterministic state machine that renders 402 × 874 SVG frames:

- **Screens**: home, store, app detail, app scene. A stack supports back/home.
- **State**: installed ids, current screen, active install, query, battery, boot time.
- **Hotspots**: every tappable region is emitted with the frame. The renderer overlays
  invisible, accessible buttons with labels ("Install Spotify", "Open Google Play"). This
  gives real hit targets and keyboard focus without image-map math.
- **Assets**: original monogram paths shared by React and the SVG renderer; no external
  images, no third-party logos, no network.
- **Apps**: 14 catalog entries with a `scene` (music, social, chat, video, maps, learning,
  notes, travel, mail, workspace, ride) rendered with app-specific colors and content.

Because the output is SVG, the same engine produces crisp frames at any size and the demo
can run on any OS without a device.

## Phone models

`src/shared/phone-models.ts` is the built-in hardware catalog: 9 Android and 9 iPhone
profiles with name, manufacturer, OS, physical resolution, screen inches and frame colour.
`DemoDevice` owns one profile; changing it resets navigation but keeps installed apps.
Custom profiles live in `settings.customModels`, are validated in the main process, and
are capped at 40. Each platform has a persisted default model ID. The Models sheet supports
search by name, brand, OS, size or resolution, `Use`, `Set default` and delete. Selecting a
model switches to that demo; adding one saves it as the platform default. Real devices are
never affected by these profiles.

## State and IPC

`DeviceManager.getState()` is the single snapshot: devices, active id, installed apps,
catalog, phone models and defaults, activity, preview metadata, install progress, tool
status, settings, version, platform, QR payload. Mutations call `emitState()`, which broadcasts a full snapshot. The
renderer also merges high-frequency events (frames, install progress, activity, toasts)
without waiting for a snapshot.

Channels follow a small convention:

```
phone:state            phone:refresh          phone:select
phone:demo             phone:preview:start    phone:preview:stop
phone:tap              phone:longpress        phone:scroll       phone:pinch
phone:swipe            phone:press            phone:type
phone:store:open       phone:store:search     phone:app:install  phone:app:open
phone:app:install-file phone:qr:show          phone:qr:hide      phone:external
phone:wifi             phone:setting          phone:activity:clear
phone:model:select     phone:model:default    phone:model:add    phone:model:delete
```

Events are one channel, `phone:event`, with a discriminated union: `state`, `frame`,
`activity`, `install`, `toast`, `preview`. That keeps preload tiny and makes the contract
easy to test.

## Persistence

`settings.json` lives in Electron's `userData` directory. In development it is redirected
to `.data/electron-userdata` inside the repo so the test environment never writes to
Application Support. `PHONEEXPLORER_DATA_DIR` overrides it for E2E and screenshots.

Persisted keys: fps (1–10), JPEG quality (40–95), auto preview, custom adb path, default
demo platform, reduce motion. Settings are clamped on load and saved on change.

## Failure handling

- **adb missing** → tools card, setup instructions, demo remains usable.
- **unauthorized Android** → device card with "Allow on phone" guidance; no commands run.
- **iPhone without idb** → mirror or touch capabilities are false; store falls back to QR.
- **Screenshot failure** → one warning, backoff, then stop preview after four failures.
- **Install timeout** → after five minutes, mark failed with a retry button and a log line.
- **Device unplugged** → preview stops, selection moves to another online device or the
  demo, installed list resets.
- **Renderer reload** → `getState()` restores the full snapshot; frames resume within one
  tick.

## Security

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Preload exposes a fixed, typed API; no `ipcRenderer` or `require` reaches the page.
- CSP: `default-src 'self'`; images are `data:`/`blob:`; styles allow inline because the
  design system uses React inline styles; scripts are self only.
- `setWindowOpenHandler` and `will-navigate` deny in-app navigation and hand HTTP(S) to the
  system browser.
- External store links are the only outbound traffic initiated by the app. No analytics,
  accounts, or background network services.
- QR codes are generated locally with `qrcode` (bundled into main at build time).
- The scrcpy server is a vendored, unmodified Apache-2.0 binary; it is pushed to the phone
  only when an Android device is selected. It runs entirely over the USB/Wi-Fi ADB
  connection and is removed by scrcpy's cleanup path.

## Testing

| Layer | What it proves |
| --- | --- |
| `vitest` scene tests | every demo screen on both platforms produces well-formed SVG; hotspots exist |
| `scripts/e2e.mjs` | full renderer flow on the demo: store, install, open, iPhone, app sheet, QR, focus, settings |
| `scripts/e2e-models.mjs` | search, switch, add, default, persist and delete demo hardware profiles |
| `scripts/e2e-gestures.mjs` | guide, right-click Back, wheel scroll, pinch fallback and long-press on the demo |
| `scripts/e2e-real.mjs` | real Android pipeline against a fake `adb`: discovery, `screencap` frames, install detection, `monkey` launch, `market://` links, scroll, long-press, Back/Home, pinch fallback |
| `scrcpy-control.test.ts` | the control session fails closed and rejects gestures when unavailable |
| `xmllint` (dev) | every generated SVG is valid XML |

The fake adb is not a mock of `AdbClient`; it is a process at the `adb` boundary. That
means CLI parsing, buffering, timeouts, screenshot decoding, package polling and launch all
run exactly as they will with a real phone.

## Build

`electron-vite` builds three bundles: main (CJS), preload (CJS) and renderer (ESM).
`qrcode` is bundled into main. The ESM-only scrcpy packages stay externalized and are
included as production dependencies; `vendor/scrcpy-server` is copied through
`extraResources`. `electron-builder.yml` produces an unsigned DMG/ZIP target on macOS with
the generated icon; Windows/Linux targets are configured but untested.

## Stage 02 candidates

1. **scrcpy video**: reuse the control session's ADB transport for the H.264 stream and
   WebCodecs decoder; 30–60 fps, audio later.
2. **iPhone multi-touch**: WebDriverAgent or a CoreMediaIO helper for pinch and app-switch
   gestures. The current iPhone bridge is single-touch.
3. **iOS live capture**: a small Swift helper using AVFoundation/CoreMediaIO (the mechanism
   QuickTime uses), shipped as a signed helper or optional download.
4. **Wireless pairing**: `adb pair` flow with a code, QR for iOS.
5. **Accessibility/UIAutomator** tree for app-aware actions ("tap the third tab").
6. **Remote catalog**: a signed manifest with verified IDs and per-region store links.
