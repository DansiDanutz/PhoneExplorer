# Contributing

PhoneExplorer is at Stage 01. The most useful contributions right now are real-device
logs, iPhone bridge fixes, and the scrcpy/WebCodecs preview.

## Setup

```bash
npm install
npm run dev
```

If Electron was installed with npm's script sandbox disabled, run its installer manually:

```bash
node node_modules/electron/install.js
```

## Before opening a PR

```bash
npm run typecheck
npm test
npm run e2e
npm run e2e:real
```

`npm run e2e` and `e2e:real` launch Electron with `--no-sandbox` for CI/agent environments.
They do not require a phone. If you add a scene or a device command, extend the relevant
test.

## Real-device reports

A useful report includes:

- platform and OS version, connection type (USB / Wi-Fi);
- the Activity panel lines around the failure;
- `adb devices -l` or `idb list-targets --json` output with serials redacted;
- whether the demo path works.

Never paste store credentials, Apple ID tokens, or full device backups.

## Code conventions

- TypeScript strict; no `any` unless at a process boundary with a comment.
- Renderer has no Node access; add capabilities to `PhoneAPI` and the preload, not via
  `remote` or ad-hoc IPC.
- Device work belongs in `src/main/services`, not in React components.
- Every user-visible failure should reach Activity with a readable detail.
- Demo screens are SVG; keep them free of external images and third-party marks.
- Run `xmllint --noout` over generated scene SVGs if you touch the demo engine.

## Adding a catalog app

1. Add an entry to `src/shared/catalog.ts` with a real Android package and iOS app id /
   bundle id.
2. Pick an existing `scene` and an original monogram `mark`.
3. Verify the Android package id with `adb shell pm list packages | grep …` and the iOS
   bundle id with `idb list-apps`.
4. Add the entry to the screenshot scene test by running `npm test` (it iterates the
   catalog automatically).

## License

By contributing, you agree that your contribution is licensed under the MIT license.
