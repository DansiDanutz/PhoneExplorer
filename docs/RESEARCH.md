# Research notes — building a phone bridge in Electron

Stage 01 began with a survey of the open-source phone-mirroring landscape. This document
records what exists, what we borrowed, what we rejected, and why the first version looks
the way it does. Links and license identifiers were checked in November 2026.

## The question

Can an Electron app show a phone screen, open the phone's real app store, install an app,
and launch it — without shipping a proprietary agent or asking for store credentials?

The short answer: **yes for Android, mostly for iPhone.** The difference is not Electron.
It is what each platform exposes to a desktop computer.

## Android: a mature mirroring ecosystem

### scrcpy

[scrcpy](https://github.com/Genymobile/scrcpy) (Apache-2.0) is the reference. It pushes a
small server to the device over `adb`, opens a video socket carrying H.264/H.265, and a
control socket for input. It needs no root and installs nothing permanently. At the time
of writing it advertises 30–120 fps, 35–70 ms latency, and screen-off mirroring. The
project's own README is the best description of the protocol and the constraints.

Ideas taken:

- Do not require root or an on-device app.
- Treat the device as the source of truth; the desktop is a viewer/controller.
- Prefer a narrow, inspectable command surface over a large agent.
- Keep the user's existing `adb` setup; do not reinvent pairing.

Ideas not taken (yet):

- Embedding the native scrcpy window. It is hard to embed in Electron on macOS, and
  bundling per-platform binaries adds signing and update complexity. Stage 01 ships the
  cross-platform server jar for control only; it does not embed the native window.

### Escrcpy and QtScrcpy

[Escrcpy](https://github.com/viarotel-org/escrcpy) (Apache-2.0) is the clearest prior art
for the product shape: an Electron GUI over scrcpy with multi-device management, wireless
QR pairing, automation, themes, window layout, and per-device configuration.

[QtScrcpy](https://github.com/barry-ran/QtScrcpy) (Apache-2.0) is the C++/Qt equivalent,
with strong key-mapping and low-latency rendering.

Ideas taken:

- A device rail with one active device, not a wall of windows.
- Per-device status, battery and resolution at a glance.
- A visible activity console; bridge tools fail in specific, explainable ways.
- Wireless connect as a first-class action.

Ideas not taken:

- Embedding a native scrcpy window over the app. It works, but it feels like a separate
  window, breaks under screen sharing/virtual desktops, and is platform-specific.
- A full settings surface for every scrcpy flag. Stage 01 exposes only the few controls
  that affect the preview the user is looking at.

### @yume-chan/scrcpy

[@yume-chan/scrcpy](https://github.com/yume-chan/scrcpy) (Apache-2.0) is a TypeScript
implementation of the scrcpy protocol, including ADB over WebUSB/WebSocket, H.264
demuxing, and WebCodecs/TinyH264 decoders. It is the most promising route to a true in-app
30–60 fps mirror without native binaries.

Why not the video path in Stage 01:

- It is a larger dependency and protocol surface than the rest of the app combined.
- It benefits from a real device to tune latency, keyframes and reconnects. We did not have
  one in this environment, and shipping an untested streaming path would be worse than an
  honest screenshot loop.
- The screenshot pipeline already validates discovery, input coordinates, store links and
  install detection. Those are reusable when the video path lands.

Stage 01 now uses `@yume-chan/adb` and `@yume-chan/adb-scrcpy` for a **control-only**
scrcpy session: the vendored scrcpy 3.3.3 server starts with `video=false`, and its
control channel provides multi-touch pinch, scroll, drag and long-press while frames still
come from the screenshot engine. This is intentionally half of the integration — the video
path remains Stage 02 — but it closes the most important interaction gap without waiting
for the decoder work. The session fails closed and every gesture falls back to adb.

## iPhone: no public screen-capture API

Apple does not offer a supported "give me the iPhone screen" API for third-party desktop
apps. Several routes exist, each with a cost:

### libimobiledevice

[libimobiledevice](https://libimobiledevice.org) (LGPL-2.1) is a cross-platform library and
CLI suite that speaks the usbmuxd / lockdown protocols. Relevant tools:

- `idevice_id -l` — list UDIDs.
- `ideviceinfo` — product type, iOS version, name, battery and more.
- `idevicescreenshot` — capture a screenshot (TIFF; converted with `sips`).
- `ideviceinstaller` — list/install IPA files.

It is small, scriptable and does not require Xcode. It does **not** provide live video or
touch injection.

### idb (Facebook)

[idb](https://github.com/facebook/idb) (MIT) is a Python/ObjC bridge built on
`idb_companion`. In addition to device listing and screenshots, it exposes:

- `idb ui tap` / `idb ui swipe` — touch injection.
- `idb open-url` — open an `itms-apps://` URL on the device.
- `idb launch` — launch by bundle id.
- `idb list-apps` — enumerate installed apps.

This is the most useful single tool for our iPhone flow, and the reason the setup
instructions recommend it on top of libimobiledevice. It is heavier and requires a
companion binary, so each capability is probed independently and the UI degrades.

### WebDriverAgent / Appium

[WebDriverAgent](https://github.com/appium/WebDriverAgent) is Apple's XCTest-based UI
automation runner, maintained by the Appium project. It can tap, type, query the
accessibility tree and return screenshots. It is powerful but requires a signed runner,
a WebDriver session and more setup than a consumer desktop app should demand. We treat it
as a Stage 02/03 option for automation, not as the base transport.

### QuickTime, CoreMediaIO and iPhone Mirroring

QuickTime Player can show a connected iPhone screen. It uses a CoreMediaIO device exposed
by macOS; the mechanism is not a documented public API for third-party embedding, and it
has historically been sensitive to OS updates and entitlements. macOS 15's **iPhone
Mirroring** is an Apple system feature with no public automation/embedding API.

A native Swift helper that captures the CoreMediaIO device is plausible (and is how some
commercial apps do it), but it is a separate signed component and cannot be validated
without hardware. Stage 01 therefore uses screenshots for iPhone and documents the gap.

### App Store installs

There is no public API to install an App Store app programmatically. The App Store's
download confirmation is a user action. What can be automated:

- open the listing (`itms-apps://apps.apple.com/app/id…`),
- detect the installed bundle id (`idb list-apps`),
- launch it (`idb launch`).

What cannot: pressing "Get" / "Install" for the user. PhoneExplorer does not try. When
idb is unavailable to open the URL, it shows a QR code for the listing.

## The store question

Both stores are designed so that a desktop app cannot silently install software. That is
a good default. The design we landed on:

| Step | Android | iPhone |
| --- | --- | --- |
| Open listing | `market://details?id=…` via `am start` | `itms-apps://…` via `idb open-url` |
| Search | `market://search?q=…` | `itms-apps://itunes.apple.com/search?term=…` |
| User installs | Play Store UI | App Store UI |
| Detect install | poll `pm list packages` | poll `idb list-apps` |
| Launch | `monkey` / `am start -n` | `idb launch` / `devicectl` |

Alternatives considered and rejected:

- **Scraping the web stores.** Against the stores' terms, brittle, and cannot see
  region/account-specific state. The phone already has the correct store session.
- **Play Store install automation.** Possible only with privileged access or accessibility
  automation, both of which are fragile, invasive, and outside the "no credentials" rule.
- **A fake in-app store for real devices.** Misleading. We deep-link the real thing.

The catalog is curated desktop-side so we can show a useful shelf, but it always opens the
real listing and always verifies the real package/bundle id.

## Comparing mirroring approaches

| Approach | Typical rate | Extra dependency | Quality | Inside the window | Stage 01 |
| --- | --- | --- | --- | --- | --- |
| `adb exec-out screencap` polling | 1–10 fps | adb only | Full resolution, re-encoded | Yes | **Chosen** |
| scrcpy native window | 30–120 fps | scrcpy + native embedding | Excellent | No (separate window) | Rejected |
| scrcpy control channel | n/a (input only) | npm + 88 KB server | Native input | Yes | **Chosen for Android input** |
| scrcpy protocol + WebCodecs | 30–60 fps | npm packages | Excellent | Yes | Stage 02 video |
| iOS `idevicescreenshot` / `idb screenshot` | ~1 fps | libimobiledevice/idb | Full resolution | Yes | **Chosen** |
| iOS CoreMediaIO helper | 30–60 fps | Signed native helper | Excellent | Yes | Stage 02/03 |
| WebDriverAgent screenshots | ~1–10 fps | Signed WDA + session | Full resolution | Yes | Rejected for now |

Screenshot polling is not glamorous, but it has a property that matters for a first stage:
the entire path is inspectable in Activity, works with the tools users already have, and
fails with a readable error instead of a black rectangle.

## Testing lessons

Two real bugs were found by the fake-adb E2E, not by reading code:

1. **The custom adb path was ignored after restart.** `AdbClient` resolved the system adb
   at construction time; settings loaded later. Fixed by re-resolving after `loadSettings`.
2. **A fake device returned a truncated PNG.** The stand-in called `process.exit()` right
   after `stdout.write()`, which can truncate a pipe. The native image decoder then failed.
   Fixed with a synchronous write. This is a reminder that the bridge is a process
   boundary, not an in-memory API.

The scene tests also caught a duplicate `letter-spacing` attribute in the generated SVG,
which made the whole home screen fail to decode in Chromium. `xmllint` is now part of the
development loop for every generated screen.

## What we would do next

1. **scrcpy video + WebCodecs** on top of the existing control session (30–60 fps, audio
   later).
2. **iPhone multi-touch** through WebDriverAgent or a CoreMediaIO native helper.
3. **CoreMediaIO Swift helper** for iPhone live capture, plus notarization.
4. **`adb pair`** for Android 11+ wireless debugging, not just `adb connect`.
5. **UIAutomator / accessibility** queries so the app can find "Install" or "Open" by
   label instead of relying on the user's tap.
6. **Remote catalog** with verified store IDs, region-aware URLs, and icons from the store.
7. **Signed/notarized releases** and a Homebrew cask.

## Sources

- [scrcpy](https://github.com/Genymobile/scrcpy) — Apache-2.0; README, protocol docs.
- [Escrcpy](https://github.com/viarotel-org/escrcpy) — Apache-2.0.
- [QtScrcpy](https://github.com/barry-ran/QtScrcpy) — Apache-2.0.
- [@yume-chan/scrcpy](https://github.com/yume-chan/scrcpy) — Apache-2.0.
- [Android platform-tools / adb](https://developer.android.com/tools/adb) — Android SDK.
- [libimobiledevice](https://libimobiledevice.org) — LGPL-2.1.
- [idb](https://github.com/facebook/idb) — MIT.
- [WebDriverAgent](https://github.com/appium/WebDriverAgent) — Appium project.
- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).
- [electron-vite](https://electron-vite.org) — MIT.
- [electron-builder](https://www.electron.build) — MIT.
- [Playwright](https://playwright.dev) — Apache-2.0.

Store URL schemes and store behavior are platform interfaces, not open-source projects;
they are described here from the public Android/iOS documentation and from observing the
devices' behavior. They can change without notice.
