# pinata-mcp

MCP-сервер для пина файлов и JSON в IPFS через [Pinata](https://pinata.cloud).
Ключи берутся из переменных окружения — в репозитории секретов нет.

## Инструменты

| Tool | Аргументы | Возвращает |
|------|-----------|------------|
| `pinata_pin_file` | `path` (string), `name?` | `{ cid, size, timestamp, url }` |
| `pinata_pin_json` | `content` (any), `name?` | `{ cid, size, timestamp, url }` |
| `pinata_unpin` | `cid` (string) | подтверждение |
| `pinata_list` | `limit?` (1–1000, по умолч. 10) | сырой список пинов Pinata |

`url` — готовая публичная ссылка на gateway: `https://<gateway>/ipfs/<cid>`.

---

## Установка

### 1. Получить ключ Pinata

Pinata dashboard → **API Keys** → **New Key**.
Права: `pinFileToIPFS`, `pinJSONToIPFS`, `unpin`, `pinList`.
Скопировать **JWT**.

### 2. Положить ключ в окружение

Добавить в `~/.zshrc`:

```sh
export PINATA_JWT="eyJhbGci..."
```

Затем `source ~/.zshrc`.

Альтернатива (старый способ, вместо JWT):

```sh
export PINATA_API_KEY="..."
export PINATA_SECRET_API_KEY="..."
```

Необязательно — свой gateway (по умолчанию `gateway.pinata.cloud`):

```sh
export PINATA_GATEWAY="your-gateway.mypinata.cloud"
```

### 3. Собрать сервер

```sh
cd ~/git/mcps/pinata
npm install
npm run build
```

### 4. Зарегистрировать в Claude Code

```sh
claude mcp add pinata --scope user \
  --env PINATA_JWT="$PINATA_JWT" \
  -- node ~/git/mcps/pinata/dist/index.js
```

Проверить:

```sh
claude mcp list   # pinata: ... ✔ Connected
```

### 5. Перезапустить Claude Code

MCP-серверы грузятся на старте — без рестарта инструменты `pinata_*` в чате не появятся.

> Секрет, переданный через `--env`, записывается в `~/.claude.json` в открытом
> виде. Чтобы держать конфиг без секрета, вместо значения укажи `${PINATA_JWT}`
> — но тогда приложение должно унаследовать переменную окружения (работает при
> запуске из терминала, не из GUI-иконки).

---

## Как пользоваться

Проси агента обычным языком — он сам выберет нужный инструмент.

- «Запинь `~/Downloads/art.png` в IPFS и дай ссылку»
  → `pinata_pin_file { "path": "/Users/wotori/Downloads/art.png" }`
- «Запинь эту метадату как JSON»
  → `pinata_pin_json { "content": { ... }, "name": "token-meta" }`
- «Покажи последние 5 пинов» → `pinata_list { "limit": 5 }`
- «Удали пин Qm...» → `pinata_unpin { "cid": "Qm..." }`

Каждый пин возвращает готовую ссылку в поле `url`:

```json
{
  "cid": "bafybei...",
  "size": 20451,
  "timestamp": "2026-06-27T10:00:00.000Z",
  "url": "https://gateway.pinata.cloud/ipfs/bafybei..."
}
```

Используй `url` напрямую как публичную ссылку на файл.

---

## Troubleshooting

- **"credentials are not configured"** → сервер не видит переменные. Передай их
  в блоке `env` MCP-конфига (shell-экспорты не доходят до GUI-приложения).
- **Инструменты не появились в чате** → перезапусти Claude Code.
- **Изменил `src/`** → снова `npm run build` (сервер запускает `dist/`).

## Проверка вручную (без Claude Code)

```sh
# auth
curl -s -o /dev/null -w "%{http_code}\n" \
  https://api.pinata.cloud/data/testAuthentication \
  -H "Authorization: Bearer $PINATA_JWT"   # 200 = ок

# пин файла напрямую через сервер
printf '%s\n%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pinata_pin_file","arguments":{"path":"/path/to/file"}}}' \
| node ~/git/mcps/pinata/dist/index.js
```
