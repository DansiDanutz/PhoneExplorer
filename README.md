# PhoneExplorer

[![CI](https://github.com/DansiDanutz/PhoneExplorer/actions/workflows/ci.yml/badge.svg)](https://github.com/DansiDanutz/PhoneExplorer/actions/workflows/ci.yml)

**Stage 01 — a desktop bridge for your phone.**

PhoneExplorer puts an Android phone or iPhone on your desktop: a near-live screen, the
real Google Play / App Store listing, one place to install, and one click to launch.
It is built with Electron, TypeScript and React, and it talks to phones through the
open-source tools the platform already has — `adb`, `libimobiledevice` and `idb`.

![PhoneExplorer showing a simulated Pixel 9 Pro, Google Play and the Discover panel](docs/screenshots/home.png)

> **The store stays on the phone.** PhoneExplorer deep-links the real listing and watches
> the device's package list. It never asks for an Apple ID or Google password, never
> scrapes a store, and never installs an App Store app behind your back.

---

## Why

Installing and previewing a mobile app usually means picking the phone up, unlocking it,
finding the store, tapping through, then putting it down again. That loop is small but
constant. PhoneExplorer keeps it on the desktop:

1. **Connect** an Android phone over USB/Wi-Fi, or an iPhone over USB.
2. **Mirror** the screen next to your editor.
3. **Open** the real Play Store / App Store listing from the Discover panel.
4. **Install** on the phone (the store owns the download).
5. **Launch** it from PhoneExplorer and look at it in the mirror.

Stage 01 is deliberately honest about what it automates. Android is fully wired. iPhone
support is real but depends on the open-source iOS bridge; installing from the App Store
is always a user action. No phone? A complete interactive demo phone runs locally.

---

## What works

| Capability | Android | iPhone |
| --- | --- | --- |
| Device discovery | `adb devices`, USB + Wi-Fi | `libimobiledevice` or `idb` |
| Screen preview | `adb exec-out screencap` at 1–10 fps | `idb screenshot` or `idevicescreenshot` |
| Tap / swipe / keys | `adb shell input` | `idb ui` (touch) |
| Store deep link | `market://details`, `market://search` | `itms-apps://` via `idb open-url` |
| Install detection | watches `pm list packages` | watches `idb list-apps` |
| Launch app | `monkey` / `am start` | `idb launch` or `devicectl` |
| Sideload | `adb install -r` (`.apk`) | `ideviceinstaller` / `devicectl` (signed `.ipa`) |
| Demo phone | fully simulated Pixel | fully simulated iPhone |

**Near-live, not video (yet).** Stage 01 captures screenshots at a configurable rate
instead of decoding a video stream. It is enough to judge layouts, navigate the store and
see an app open. A scrcpy/WebCodecs pipeline is the first item on the roadmap.

### The demo lab

Both demo devices are interactive end to end. Tapping **Get** inside the simulated store
runs a real install animation, adds the icon to the home screen, flips the button to
**Open**, and launches a scene built for that app. This makes the app usable immediately
and gives the automated tests a hardware-free target.

| | |
| --- | --- |
| ![Google Play inside the demo phone](docs/screenshots/store.png) | ![Spotify launched on the demo phone](docs/screenshots/spotify.png) |
| ![iPhone App Store on the demo phone](docs/screenshots/iphone-store.png) | ![WhatsApp chat on the demo phone](docs/screenshots/iphone-chat.png) |

---

## Quick start

Requirements: **Node 20+**, **macOS 13+** (primary target), or Windows/Linux for the
Android path. A phone is optional.

```bash
git clone https://github.com/DansiDanutz/PhoneExplorer.git
cd PhoneExplorer
npm install
npm run dev
```

The app opens with the **demo lab** selected if no phone is attached.

### Android

1. On the phone, open **Settings → About phone** and tap **Build number** seven times.
2. Open **Developer options** and enable **USB debugging**.
3. Plug in the phone and tap **Allow** on the debugging prompt.
4. Install the platform tools if needed:

   ```bash
   brew install android-platform-tools
   ```

5. Press **Scan again** (or ⌘R). The phone appears under **Devices**.

For wireless debugging, Android 11+ shows an `IP:port` in **Developer options → Wireless
debugging**. Pair once on the phone, then enter the address in **Connect a phone**. For
older devices, `adb tcpip 5555` on a USB connection works.

### iPhone

The iPhone bridge is [libimobiledevice](https://libimobiledevice.org) plus
[`idb`](https://github.com/facebook/idb) for touch, launch and store links:

```bash
brew install libimobiledevice
brew tap facebook/fb
brew install idb-companion
pipx install fb-idb
```

Plug in the iPhone, unlock it, and tap **Trust This Computer**. Then press **Scan again**.

- `libimobiledevice` is enough for discovery, screenshots and install detection.
- `idb` adds touch input, launch, and `itms-apps://` deep links.
- Xcode 15+ also provides `devicectl`, which PhoneExplorer uses for launch/install when
  idb is absent.
- If no bridge is available, the store panel falls back to a **QR code** you can scan with
  the phone camera.

App Store installs cannot be automated: the App Store's download confirmation is a user
action. PhoneExplorer opens the listing and detects the install when it lands.

---

## Using it

- **Discover** searches the curated catalog and deep-links the real store. Press **↵** to
  send the query to the phone's store.
- **Get** opens the listing on the phone (demo: installs locally). When the package
  appears, the button flips to **Open**.
- **Installed** lists apps read from the device, including system apps matched to the
  catalog. Click any icon to launch it.
- **Activity** is a timestamped log of every bridge command, launch and install event.
- **Click the mirror** to tap; **drag** to swipe. The pill below the phone has Back, Home,
  Recents, volume, power and a keyboard input.
- **Focus mode** hides both rails; **Esc** returns.

Other screens: [app detail](docs/screenshots/app-detail.png) ·
[installed apps](docs/screenshots/installed.png) ·
[connection setup](docs/screenshots/connect.png) ·
[settings](docs/screenshots/settings.png) ·
[app sheet](docs/screenshots/app-sheet.png) ·
[QR handoff](docs/screenshots/qr.png) ·
[focus mode](docs/screenshots/focus.png).

---

## How it works

```
┌──────────────────────────── Electron main ────────────────────────────┐
│ DeviceManager                                                        │
│  ├─ AdbClient          → adb: devices, getprop, screencap, input, …   │
│  ├─ IosBridge          → idb / libimobiledevice / devicectl           │
│  ├─ DemoDevice ×2      → deterministic SVG phone screens              │
│  ├─ install watcher    → pm list packages / idb list-apps             │
│  └─ preview engine     → PNG → nativeImage → JPEG → IPC               │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ contextBridge + typed IPC
┌───────────────────────────────▼───────────────────────────────────────┐
│ React renderer                                                       │
│  Device rail · phone stage · Discover / Installed / Activity         │
└───────────────────────────────────────────────────────────────────────┘
```

The phone is always the source of truth. The desktop is an orchestrator: it asks for a
screenshot, sends an input event, opens a URL, and reads the package list. It does not
proxy the store or hold credentials.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Open-source survey and design rationale: [docs/RESEARCH.md](docs/RESEARCH.md).

### Security posture

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- A single typed preload bridge; no Node APIs in the renderer.
- CSP allows local scripts, data images and the dev server only.
- External navigation is denied and handed to the system browser.
- No telemetry, no accounts, no network services of our own. Everything is local.
- The only outbound requests are the store pages you explicitly open (and the optional
  links in Settings).

---

## Development

```bash
npm run dev         # electron-vite dev server + Electron
npm run build       # build main, preload and renderer
npm run typecheck   # strict TS across all three targets
npm test            # unit + scene rendering tests
npm run e2e         # Playwright: demo install → open → iPhone → settings
npm run e2e:real    # Playwright + a fake adb: discovery, mirror, install, launch
npm run showcase    # regenerate docs/showcase screenshots
npm run icon        # rebuild build/icon.png + icon.icns
npm run dist        # electron-builder: dmg + zip (macOS)
```

### Testing strategy

- **Unit / scene tests** render every demo screen (home, store, detail and all 14 app
  scenes on both platforms) and assert well-formed output. The SVG files are also checked
  with `xmllint` in development.
- **Demo E2E** drives the real renderer with Playwright: connect, store, install, open,
  iPhone switch, app sheet, QR, focus mode, settings and connect sheet.
- **Real-path E2E** points the app at `scripts/fake-adb.mjs`, a tiny adb stand-in that
  implements device discovery, screenshots, package lists, input and store deep links.
  It proves the Android pipeline without hardware: frame capture, install detection via
  `pm list packages`, `monkey` launch, and `market://` links.

> The E2E scripts launch Electron with `--no-sandbox` because they run inside a CI/agent
> sandbox. The shipped app keeps Chromium's sandbox on.

### Project layout

```
src/
  main/
    index.ts                 Electron lifecycle, window, IPC, screenshot harness
    services/
      manager.ts             state, device orchestration, preview + install watchers
      adb.ts                 adb wrapper + parsers
      ios.ts                 idb / libimobiledevice / devicectl bridge
      demo.ts                interactive simulated phones (SVG scene engine)
  preload/index.ts           contextBridge API
  renderer/                  React UI (no UI framework, hand-built design system)
  shared/                    types, app catalog, store links, monogram marks
scripts/
  e2e.mjs · e2e-real.mjs · fake-adb.mjs · showcase.mjs
  contact-sheet.mjs · make-icon.mjs · fixture-screen.mjs
docs/                        architecture, research, screenshots
```

---

## Limitations (Stage 01)

- **Preview is screenshot polling**, capped at 10 fps. Latency is typically a few hundred
  milliseconds. Stage 02 will decode scrcpy's H.264 stream in the renderer with WebCodecs
  for 30–60 fps and real input latency.
- **No audio.** scrcpy audio forwarding is also a Stage 02 goal.
- **iPhone live capture** uses the same screenshot loop. A native CoreMediaIO/AVFoundation
  helper (the path QuickTime uses) is the next step; macOS 15's iPhone Mirroring has no
  public embedding API.
- **App Store installs are user-driven.** Deep-linking works; silent installs do not, by
  platform design. The QR fallback covers phones where idb cannot open URLs.
- **Notion, Slack and store metadata** in the catalog are illustrative. IDs can change;
  the real listing is always the phone's.
- The Android code path is covered by the fake-adb E2E but has not been run against a
  physical phone in this environment. The iPhone bridge was likewise validated against
  its command contract, not hardware. See [docs/RESEARCH.md](docs/RESEARCH.md) for the
  support matrix and how to contribute real-device logs.
- Windows/Linux packaging is configured but macOS is the tested target.

---

## Open-source ideas we started from

PhoneExplorer would not exist without these projects. The full survey — what we borrowed,
what we deliberately did not, and licenses — is in [docs/RESEARCH.md](docs/RESEARCH.md).

- [scrcpy](https://github.com/Genymobile/scrcpy) — the reference Android mirroring tool.
- [Escrcpy](https://github.com/viarotel-org/escrcpy) — an Electron GUI over scrcpy; the
  clearest prior art for this product shape.
- [QtScrcpy](https://github.com/barry-ran/QtScrcpy) — cross-platform GUI and key-mapping.
- [@yume-chan/scrcpy](https://github.com/yume-chan/scrcpy) — TypeScript scrcpy protocol
  and WebCodecs decoders; our planned Stage 02 path.
- [libimobiledevice](https://libimobiledevice.org) and [idb](https://github.com/facebook/idb)
  — the iPhone bridge.
- [electron-vite](https://electron-vite.org) and
  [electron-builder](https://www.electron.build) — build and packaging.
- [Playwright](https://playwright.dev) — renderer and Electron E2E.

App icons in the UI and demo are original geometric monograms, not third-party artwork.

---

## License

MIT © 2026 DansiDanutz. See [LICENSE](LICENSE).
