# PhoneExplorer MCP bridge

PhoneExplorer can be driven from Codex, Claude Code, DeepSeek or any other MCP
client. The app exposes a token-authenticated loopback bridge; the companion
server translates MCP stdio calls into bridge requests.

```
MCP client → mcp/server.mjs → 127.0.0.1 bridge → PhoneExplorer → adb / Library / Artefacts
```

## Start the app

Open PhoneExplorer normally. The bridge starts with the app and writes:

```text
~/Library/Application Support/PhoneExplorer/mcp-bridge.json
```

The file contains the loopback port and a one-time bearer token. It is written
with mode `0600` and removed on quit.

## Register the server

### Codex

`~/.codex/config.toml`

```toml
[mcp_servers.phoneexplorer]
command = "node"
args = ["/Users/davidai/.t3/projects/phoneexplorer/mcp/server.mjs"]
startup_timeout_sec = 20
```

For the installed app:

```toml
args = ["/Users/davidai/Applications/PhoneExplorer.app/Contents/Resources/mcp/server.mjs"]
```

### Claude Code

The repository includes [`.mcp.json`](../.mcp.json), so Claude Code opened in this
project will offer the **phoneexplorer** server. On this machine the server is
also registered globally in `~/.claude.json`; restart Claude Code and approve the
project server if prompted.

If `claude mcp add` reports the config is locked, use the project `.mcp.json`
instead of editing the global file while Claude Desktop is running.

### DeepSeek or any generic MCP client

```json
{
  "mcpServers": {
    "phoneexplorer": {
      "command": "node",
      "args": ["/Users/davidai/.t3/projects/phoneexplorer/mcp/server.mjs"]
    }
  }
}
```

Set `PHONEEXPLORER_BRIDGE_FILE` only when the bridge file lives elsewhere.

## Tools

| Tool | Read/write | Purpose |
|---|---|---|
| `phone_status` | read | Active device, version, folder |
| `phone_refresh` | read | Re-scan connected phones |
| `phone_select_device` | write | Select a device id from status |
| `phone_screenshot` | write | Capture, save to date folder, return image |
| `phone_tap` | write | Normalized tap |
| `phone_swipe` | write | Normalized swipe |
| `phone_key` | write | Home/back/recents/power/wake/volume |
| `phone_launch_app` | write | Launch an installed package |
| `phone_dump_ui` | read | Android UI hierarchy |
| `phone_list_screenshots` | read | Library entries and ids |
| `phone_get_screenshot` | read | Return one image |
| `phone_create_artefact` | write | Date-folder document from selected ids |
| `phone_get_artefact` | read | Newest document metadata |
| `phone_record_start` | write | Start video + 2s screenshot recording |
| `phone_record_stop` | write | Stop, pull video, extract screenshots |

Screenshots created through MCP use the same current-date folders and Library
index as the UI. Artefacts are written under `Artefacts/<YYYY-MM-DD>/`.

## Security

- Loopback only; the server rejects non-local socket addresses.
- Every request needs the bearer token from `mcp-bridge.json`.
- No arbitrary shell tool is exposed.
- Coordinates are normalized and bounded.
- Package names and keys are allowlisted.
- The bridge rejects oversized bodies and unknown endpoints.
- Recording/tap/swipe/launch are marked destructive to MCP clients.

## Remote clients

A cloud Codex or remote DeepSeek runner cannot reach `127.0.0.1`. Use the MCP
stdio server on the same machine as PhoneExplorer, or add an authenticated
Streamable HTTP transport behind Tailscale/reverse proxy. Do not expose the
loopback bridge publicly.

## Test

```bash
npm run e2e:mcp
```

This launches the app with an isolated data directory, starts the MCP server,
initializes the protocol, lists tools and calls `phone_status`.
