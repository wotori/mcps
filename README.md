# mcps

Collection of [MCP](https://modelcontextprotocol.io) servers by Wotori.
Each server lives in its own subdirectory with its own README, deps, and build.

## Servers

| Server | Что делает | Папка |
|--------|-----------|-------|
| [pinata](./pinata) | Пин файлов и JSON в IPFS через Pinata, возврат CID + gateway-ссылки | `pinata/` |

## Структура

```
mcps/
├── README.md          # этот файл
├── .gitignore
└── <server>/          # один MCP-сервер = одна папка
    ├── README.md      # установка и использование
    ├── package.json
    ├── src/
    └── dist/          # сборка (в .gitignore)
```

## Добавить новый сервер

```sh
mkdir ~/git/mcps/<name> && cd ~/git/mcps/<name>
# package.json (type: module) + tsconfig.json + src/index.ts
npm install @modelcontextprotocol/sdk zod
npm run build
```

Ключи/секреты — только через переменные окружения, никогда в репозиторий.
Каждый сервер описывает свою установку в собственном `README.md`.
