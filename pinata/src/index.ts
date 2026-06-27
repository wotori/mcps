#!/usr/bin/env node
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PinataClient } from "./pinataClient.js";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

const hasCreds =
  !!PINATA_JWT || (!!PINATA_API_KEY && !!PINATA_SECRET_API_KEY);

if (!hasCreds) {
  // Don't crash – surface a readable error on each tool call instead.
  console.error(
    "Pinata credentials missing. Set PINATA_JWT, or PINATA_API_KEY + PINATA_SECRET_API_KEY.",
  );
}

const pinata = hasCreds
  ? new PinataClient(
      {
        jwt: PINATA_JWT,
        apiKey: PINATA_API_KEY,
        apiSecret: PINATA_SECRET_API_KEY,
      },
      PINATA_GATEWAY,
    )
  : null;

const tools: Tool[] = [
  {
    name: "pinata_pin_file",
    description:
      "Закрепить (запинить) локальный файл в IPFS через Pinata. Возвращает CID и публичную ссылку на gateway, которую можно использовать дальше.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Абсолютный или относительный путь к файлу на диске, который нужно запинить.",
        },
        name: {
          type: "string",
          description:
            "Необязательное имя для метаданных Pinata. По умолчанию имя файла.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "pinata_pin_json",
    description:
      "Запинить произвольный JSON-объект в IPFS через Pinata. Возвращает CID и ссылку на gateway.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          description: "JSON-данные для пина (любой объект/массив/значение).",
        },
        name: {
          type: "string",
          description: "Необязательное имя для метаданных Pinata.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "pinata_unpin",
    description: "Удалить пин по CID из Pinata.",
    inputSchema: {
      type: "object",
      properties: {
        cid: {
          type: "string",
          description: "CID (IpfsHash) ранее запиненного объекта.",
        },
      },
      required: ["cid"],
    },
  },
  {
    name: "pinata_list",
    description:
      "Получить список запиненных объектов (свежие сверху). Возвращает сырой JSON Pinata.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Сколько записей вернуть (1–1000, по умолчанию 10).",
        },
      },
    },
  },
];

const ok = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

const fail = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

async function main() {
  const server = new Server(
    {
      name: "pinata-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const transport = new StdioServerTransport();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;

      if (!pinata) {
        return fail(
          "Pinata credentials are not configured on the MCP server. " +
            "Set PINATA_JWT (or PINATA_API_KEY + PINATA_SECRET_API_KEY) and restart.",
        );
      }

      try {
        if (name === "pinata_pin_file") {
          const parsed = z
            .object({ path: z.string().min(1), name: z.string().optional() })
            .safeParse(args ?? {});
          if (!parsed.success) return fail(`Invalid arguments: ${parsed.error.message}`);

          const res = await pinata.pinFile(parsed.data.path, parsed.data.name);
          return ok(JSON.stringify(res, null, 2));
        }

        if (name === "pinata_pin_json") {
          const parsed = z
            .object({ content: z.unknown(), name: z.string().optional() })
            .safeParse(args ?? {});
          if (!parsed.success) return fail(`Invalid arguments: ${parsed.error.message}`);

          const res = await pinata.pinJson(parsed.data.content, parsed.data.name);
          return ok(JSON.stringify(res, null, 2));
        }

        if (name === "pinata_unpin") {
          const parsed = z
            .object({ cid: z.string().min(1) })
            .safeParse(args ?? {});
          if (!parsed.success) return fail(`Invalid arguments: ${parsed.error.message}`);

          await pinata.unpin(parsed.data.cid);
          return ok(`Unpinned ${parsed.data.cid}`);
        }

        if (name === "pinata_list") {
          const parsed = z
            .object({ limit: z.number().optional() })
            .safeParse(args ?? {});
          if (!parsed.success) return fail(`Invalid arguments: ${parsed.error.message}`);

          const res = await pinata.list(parsed.data.limit ?? 10);
          return ok(JSON.stringify(res, null, 2));
        }

        return fail(`Unknown tool: ${name}`);
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );

  await server.connect(transport);
}

main().catch((err) => {
  console.error("Pinata MCP server failed:", err);
  process.exit(1);
});
