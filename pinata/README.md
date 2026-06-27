# pinata-mcp

MCP server to pin files and JSON to IPFS via [Pinata](https://pinata.cloud).
Keys come from environment variables — no secrets in the repo.

## Tools

| Tool | Args | Returns |
|------|------|---------|
| `pinata_pin_file` | `path` (string), `name?` | `{ cid, size, timestamp, url }` |
| `pinata_pin_json` | `content` (any), `name?` | `{ cid, size, timestamp, url }` |
| `pinata_unpin` | `cid` (string) | confirmation |
| `pinata_list` | `limit?` (1–1000, default 10) | raw Pinata pin list |

`url` is a ready public gateway link: `https://<gateway>/ipfs/<cid>`.

---

## Install

### 1. Get a Pinata key

Pinata dashboard → **API Keys** → **New Key**.
Scopes: `pinFileToIPFS`, `pinJSONToIPFS`, `unpin`, `pinList`.
Copy the **JWT**.

### 2. Put the key in your environment

Add to `~/.zshrc`:

```sh
export PINATA_JWT="eyJhbGci..."
```

Then `source ~/.zshrc`.

Legacy alternative (instead of JWT):

```sh
export PINATA_API_KEY="..."
export PINATA_SECRET_API_KEY="..."
```

Optional — a dedicated gateway (default `gateway.pinata.cloud`):

```sh
export PINATA_GATEWAY="your-gateway.mypinata.cloud"
```

### 3. Build the server

```sh
cd ~/git/mcps/pinata
npm install
npm run build
```

### 4. Register with Claude Code

```sh
claude mcp add pinata --scope user \
  --env PINATA_JWT="$PINATA_JWT" \
  -- node ~/git/mcps/pinata/dist/index.js
```

Verify:

```sh
claude mcp list   # pinata: ... ✔ Connected
```

### 5. Restart Claude Code

MCP servers load at startup — without a restart the `pinata_*` tools won't show up in chat.

> A secret passed via `--env` is written into `~/.claude.json` in plaintext.
> To keep the config secret-free, use `${PINATA_JWT}` as the value instead — but
> then the app must inherit the env var (works when launched from a terminal,
> not from a GUI icon).

---

## Usage

Just ask the agent in plain language — it picks the right tool.

- "Pin `~/Downloads/art.png` to IPFS and give me the link"
  → `pinata_pin_file { "path": "/Users/wotori/Downloads/art.png" }`
- "Pin this metadata as JSON"
  → `pinata_pin_json { "content": { ... }, "name": "token-meta" }`
- "List my last 5 pins" → `pinata_list { "limit": 5 }`
- "Unpin Qm..." → `pinata_unpin { "cid": "Qm..." }`

Every pin returns a ready gateway link in `url`:

```json
{
  "cid": "bafybei...",
  "size": 20451,
  "timestamp": "2026-06-27T10:00:00.000Z",
  "url": "https://gateway.pinata.cloud/ipfs/bafybei..."
}
```

Use `url` directly as the public reference to the file.

---

## Troubleshooting

- **"credentials are not configured"** → the server doesn't see the env vars.
  Pass them in the `env` block of the MCP config (shell exports don't reach a
  GUI-launched app).
- **Tools missing in chat** → restart Claude Code.
- **Changed `src/`** → run `npm run build` again (the server runs `dist/`).

## Manual check (without Claude Code)

```sh
# auth
curl -s -o /dev/null -w "%{http_code}\n" \
  https://api.pinata.cloud/data/testAuthentication \
  -H "Authorization: Bearer $PINATA_JWT"   # 200 = ok

# pin a file directly through the server
printf '%s\n%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pinata_pin_file","arguments":{"path":"/path/to/file"}}}' \
| node ~/git/mcps/pinata/dist/index.js
```
