import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export const restTools = ["get", "post", "put", "patch", "delete"].map(
  (method) => ({
    name: method,
    description: `Execute ${method.toUpperCase()} against the administrator-configured REST API. Relative paths only.`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        body: {},
        query: { type: "object", additionalProperties: { type: "string" } },
      },
      required: ["path"],
      additionalProperties: false,
    },
    effect: method === "get" ? "read" : "write",
    destructive: method !== "get",
  }),
);

function publicAddress(address: string) {
  if (address.includes(":")) {
    // Only global-unicast IPv6; mapped IPv4 and local/link-local never qualify.
    return /^[23][0-9a-f]{0,3}:/i.test(address);
  }
  const [a, b] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export async function executeRest(
  input: { tool: string; token: string; args: Record<string, unknown> },
  environment = process.env,
) {
  if (!restTools.some((tool) => tool.name === input.tool))
    throw new Error("Unknown REST action");
  const base = new URL(environment.PLUGUEME_REST_BASE_URL ?? "");
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    isIP(base.hostname)
  )
    throw new Error(
      "REST base must be a public HTTPS hostname without credentials",
    );
  const addresses = await lookup(base.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new Error("REST destination is private");
  const path = input.args.path;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\?#]/.test(path) ||
    /%2f|%5c|%2e|\.\./i.test(path)
  )
    throw new Error(
      "Use a relative REST path without traversal or query parameters",
    );
  const url = new URL(base.toString().replace(/\/$/, "") + path);
  if (url.origin !== base.origin) throw new Error("REST origin changed");
  const query = input.args.query;
  if (query !== undefined) {
    if (!query || typeof query !== "object" || Array.isArray(query))
      throw new Error("Invalid query");
    for (const [key, value] of Object.entries(query)) {
      if (
        typeof value !== "string" ||
        /token|secret|key|password|authorization/i.test(key)
      )
        throw new Error("Invalid query value");
      url.searchParams.set(key, value);
    }
  }
  const header = environment.PLUGUEME_REST_KEY_HEADER ?? "Authorization";
  if (
    !/^[a-zA-Z0-9-]+$/.test(header) ||
    /^(host|connection|content-length|transfer-encoding|cookie)$/i.test(header)
  )
    throw new Error("Invalid key header");
  const value =
    header.toLowerCase() === "authorization"
      ? `Bearer ${input.token}`
      : input.token;
  const address = addresses[0];
  const body =
    input.tool !== "get" && input.args.body !== undefined
      ? JSON.stringify(input.args.body)
      : undefined;
  // Resolve once, check every answer, and pin that answer to this TLS request. No DNS rebind gap.
  let text = await new Promise<string>((resolve, reject) => {
    const outgoing = request(
      url,
      {
        method: input.tool.toUpperCase(),
        headers: { [header]: value, "content-type": "application/json" },
        lookup: (_host, options, callback) => {
          if (typeof options === "object" && options.all)
            callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (response) => {
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          response.destroy();
          reject(new Error("REST vendor rejected request"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1_000_000) {
            response.destroy();
            outgoing.destroy(new Error("REST response too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve(Buffer.concat(chunks).toString("utf8")),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.setTimeout(20_000, () =>
      outgoing.destroy(new Error("REST request timed out")),
    );
    if (body) outgoing.write(body);
    outgoing.end();
  });
  // Some debugging APIs echo Authorization. Do not propagate credentials to a model or audit.
  text = text.split(input.token).join("[REDACTED]");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
