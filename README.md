# mcps

Collection of [MCP](https://modelcontextprotocol.io) servers by Wotori.
Each server lives in its own subdirectory with its own README, deps, and build.

## Servers

| Server | What it does | Folder |
|--------|--------------|--------|
| [pinata](./pinata) | Pin files and JSON to IPFS via Pinata, returns CID + gateway URL | `pinata/` |

## Layout

```
mcps/
├── README.md          # this file
├── .gitignore
└── <server>/          # one MCP server = one folder
    ├── README.md      # install & usage
    ├── package.json
    ├── src/
    └── dist/          # build output (gitignored)
```

## Add a new server

```sh
mkdir ~/git/mcps/<name> && cd ~/git/mcps/<name>
# package.json (type: module) + tsconfig.json + src/index.ts
npm install @modelcontextprotocol/sdk zod
npm run build
```

Keys/secrets go through environment variables only — never into the repo.
Each server documents its own install in its `README.md`.
