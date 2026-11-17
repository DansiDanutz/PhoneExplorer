# PhoneExplorer MCP companion

Run PhoneExplorer first, then configure your MCP client:

```json
{
  "mcpServers": {
    "phoneexplorer": {
      "command": "node",
      "args": ["/absolute/path/to/PhoneExplorer/mcp/server.mjs"]
    }
  }
}
```

The server reads the app's loopback bridge file:

```
~/Library/Application Support/PhoneExplorer/mcp-bridge.json
```

See [../docs/MCP.md](../docs/MCP.md) for Codex, Claude Code, DeepSeek and
security details.
