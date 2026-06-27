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
      "Pin a local file to IPFS via Pinata. Returns the CID and a public gateway URL ready to use.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Absolute or relative path to the file on disk to pin.",
        },
        name: {
          type: "string",
          description:
            "Optional name for Pinata metadata. Defaults to the file name.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "pinata_pin_json",
    description:
      "Pin an arbitrary JSON object to IPFS via Pinata. Returns the CID and a gateway URL.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          description: "JSON data to pin (any object/array/value).",
        },
        name: {
          type: "string",
          description: "Optional name for Pinata metadata.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "pinata_unpin",
    description: "Remove a pin from Pinata by CID.",
    inputSchema: {
      type: "object",
      properties: {
        cid: {
          type: "string",
          description: "CID (IpfsHash) of a previously pinned object.",
        },
      },
      required: ["cid"],
    },
  },
  {
    name: "pinata_list",
    description:
      "List pinned objects (most recent first). Returns raw Pinata JSON.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "How many records to return (1–1000, default 10).",
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
