import type { ListedTool, McpCallResult } from "../plugins/mcp";

/** Vendor-neutral execution seam. Credentials, grants, approval and audit stay in PluginStore. */
export interface IntegrationBackend {
  listTools(connector: string): Promise<ListedTool[]>;
  execute(
    connector: string,
    tool: string,
    args: Record<string, unknown>,
    token: string,
  ): Promise<McpCallResult>;
}

export function createHttpIntegrationBackend(
  environment = process.env,
): IntegrationBackend {
  const address = environment.PLUGUEME_INTEGRATION_URL;
  const secret = environment.PLUGUEME_INTEGRATION_SECRET;
  if (!address || !secret || secret.length < 32)
    throw new Error("Internal integration executor is not configured");
  const base = new URL(address);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !["http:", "https:"].includes(base.protocol)
  )
    throw new Error("Invalid integration executor address");
  const invoke = async (
    connector: string,
    operation: "tools" | "call",
    body?: unknown,
  ) => {
    if (!/^[a-z0-9-]+$/.test(connector)) throw new Error("Invalid connector");
    const response = await fetch(
      new URL(`/v1/connectors/${connector}/${operation}`, base),
      {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (!response.ok)
      throw new Error(
        "Integration execution failed; do not automatically retry a change",
      );
    const payload = (await response.json()) as {
      result?: unknown;
      error?: unknown;
    };
    if (payload.error || !("result" in payload))
      throw new Error("Invalid integration executor response");
    return payload.result;
  };
  return {
    async listTools(connector) {
      const tools = await invoke(connector, "tools");
      if (
        !Array.isArray(tools) ||
        tools.some(
          (tool) => !tool || typeof tool.name !== "string" || !tool.inputSchema,
        )
      )
        throw new Error("Invalid integration tool list");
      return tools as ListedTool[];
    },
    async execute(connector, tool, args, token) {
      const result = await invoke(connector, "call", { tool, args, token });
      return {
        text: typeof result === "string" ? result : JSON.stringify(result),
        isError: false,
        truncated: false,
      };
    },
  };
}

export function integrationConnector(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "integration:" ||
    parsed.pathname !== "" ||
    !/^[a-z0-9-]+$/.test(parsed.hostname)
  )
    throw new Error("Invalid integration reference");
  return parsed.hostname;
}

export const integrationTransport = {
  listNeedsCredential: false,
  listIsThisCode: true,
  listTools: ({ url }: { url: string }) =>
    createHttpIntegrationBackend().listTools(integrationConnector(url)),
  callTool: (
    { url, token }: { url: string; token?: string },
    tool: string,
    args: Record<string, unknown>,
  ) => {
    if (!token) throw new Error("Connect your integration account first");
    return createHttpIntegrationBackend().execute(
      integrationConnector(url),
      tool,
      args,
      token,
    );
  },
};
