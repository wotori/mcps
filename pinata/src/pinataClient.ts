import { basename } from "node:path";
import { readFile, stat } from "node:fs/promises";

export interface PinResult {
  /** IPFS content identifier. */
  cid: string;
  /** Pinned object size in bytes (as reported by Pinata). */
  size: number;
  /** Timestamp when the pin was created. */
  timestamp: string;
  /** Public gateway URL pointing at the pinned content. */
  url: string;
}

export interface PinataAuth {
  /** Preferred: a Pinata JWT (scoped key). */
  jwt?: string;
  /** Legacy: API key + secret pair. */
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Thin wrapper around Pinata's classic pinning API.
 * Auth is taken from env vars by the caller and passed in here.
 */
export class PinataClient {
  private readonly apiBase = "https://api.pinata.cloud";
  private readonly gateway: string;

  constructor(
    private readonly auth: PinataAuth,
    gateway?: string,
  ) {
    // Normalize gateway to a bare host (no scheme, no trailing slash).
    const g = (gateway || "gateway.pinata.cloud")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    this.gateway = g;
  }

  private authHeaders(): Record<string, string> {
    if (this.auth.jwt) {
      return { Authorization: `Bearer ${this.auth.jwt}` };
    }
    if (this.auth.apiKey && this.auth.apiSecret) {
      return {
        pinata_api_key: this.auth.apiKey,
        pinata_secret_api_key: this.auth.apiSecret,
      };
    }
    throw new Error(
      "No Pinata credentials. Set PINATA_JWT, or PINATA_API_KEY + PINATA_SECRET_API_KEY.",
    );
  }

  gatewayUrl(cid: string): string {
    return `https://${this.gateway}/ipfs/${cid}`;
  }

  private toResult(raw: {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }): PinResult {
    return {
      cid: raw.IpfsHash,
      size: raw.PinSize,
      timestamp: raw.Timestamp,
      url: this.gatewayUrl(raw.IpfsHash),
    };
  }

  /** Pin a local file from an absolute/relative path. */
  async pinFile(path: string, name?: string): Promise<PinResult> {
    const info = await stat(path).catch(() => {
      throw new Error(`File not found: ${path}`);
    });
    if (!info.isFile()) {
      throw new Error(`Not a file: ${path}`);
    }

    const bytes = await readFile(path);
    const fileName = name || basename(path);

    const form = new FormData();
    form.append("file", new Blob([bytes]), fileName);
    form.append(
      "pinataMetadata",
      JSON.stringify({ name: fileName }),
    );

    const raw = await this.request("/pinning/pinFileToIPFS", {
      method: "POST",
      body: form,
    });
    return this.toResult(raw as never);
  }

  /** Pin an arbitrary JSON object. */
  async pinJson(content: unknown, name?: string): Promise<PinResult> {
    const body: Record<string, unknown> = { pinataContent: content };
    if (name) body.pinataMetadata = { name };

    const raw = await this.request("/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.toResult(raw as never);
  }

  /** Remove a pin by CID. */
  async unpin(cid: string): Promise<void> {
    await this.request(`/pinning/unpin/${cid}`, { method: "DELETE" }, true);
  }

  /** List pinned items (most recent first). */
  async list(limit = 10): Promise<unknown> {
    const capped = Math.max(1, Math.min(1000, limit));
    return this.request(
      `/data/pinList?status=pinned&pageLimit=${capped}`,
      { method: "GET" },
    );
  }

  private async request(
    path: string,
    init: RequestInit,
    allowEmpty = false,
  ): Promise<unknown> {
    const res = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...(init.headers || {}) },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Pinata API error ${res.status}: ${res.statusText} - ${text}`,
      );
    }

    if (allowEmpty) return undefined;
    return res.json();
  }
}
