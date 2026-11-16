# Vendored scrcpy server

`scrcpy-server` is the unmodified server binary from
[Genymobile/scrcpy v3.3.3](https://github.com/Genymobile/scrcpy/releases/tag/v3.3.3),
used only for its multi-touch control channel. It is licensed under
Apache-2.0; see `LICENSE.scrcpy`.

- Source asset: `scrcpy-server-v3.3.3`
- SHA-256: `7e70323ba7f259649dd4acce97ac4fefbae8102b2c6d91e2e7be613fd5354be0`
- Pushed to the phone as `/data/local/tmp/phoneexplorer-scrcpy-server.jar`
- The Electron app starts it with `video=false`, `audio=false`, `control=true`.
  Frames still come from the screenshot pipeline.

Verify:

```bash
shasum -a 256 vendor/scrcpy-server
```
