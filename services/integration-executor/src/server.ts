import { timingSafeEqual } from "node:crypto";
import { executeMetaAds, metaAdsTools } from "./meta-ads";
import { executeRest, restTools } from "./rest";

export function createExecutorHandler(environment = process.env) {
  const key = environment.PLUGUEME_INTEGRATION_SECRET ?? "";
  if (key.length < 32)
    throw new Error(
      "PLUGUEME_INTEGRATION_SECRET must contain at least 32 characters",
    );
  let active = 0;
  return async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET")
      return Response.json({ status: "ok" });
    const supplied = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${key}`);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return new Response(null, { status: 401 });
    const match = /^\/v1\/connectors\/([a-z0-9-]+)\/(tools|call)$/.exec(
      url.pathname,
    );
    if (
      !match ||
      !["GET", "POST"].includes(request.method) ||
      (match[2] === "tools"
        ? request.method !== "GET"
        : request.method !== "POST")
    )
      return new Response(null, { status: 404 });
    if (active >= 4) return new Response(null, { status: 429 });
    active++;
    let child: ReturnType<typeof Bun.spawn> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      let input: Record<string, unknown> = {
        operation: "list",
        connector: match[1],
      };
      if (match[2] === "call") {
        if (Number(request.headers.get("content-length")) > 1_000_000)
          return new Response(null, { status: 413 });
        const body = await request.text();
        if (Buffer.byteLength(body) > 1_000_000)
          return new Response(null, { status: 413 });
        const parsed = JSON.parse(body);
        if (
          !parsed ||
          typeof parsed.tool !== "string" ||
          typeof parsed.token !== "string" ||
          !parsed.token ||
          !parsed.args ||
          typeof parsed.args !== "object" ||
          Array.isArray(parsed.args)
        )
          return new Response(null, { status: 400 });
        input = {
          operation: "execute",
          connector: match[1],
          tool: parsed.tool,
          token: parsed.token,
          args: parsed.args,
        };
      }
      if (match[1] === "meta-ads") {
        const result =
          input.operation === "list"
            ? metaAdsTools
            : await executeMetaAds(
                input as unknown as Parameters<typeof executeMetaAds>[0],
              );
        return Response.json({ result });
      }
      if (match[1] === "rest") {
        const result =
          input.operation === "list"
            ? restTools
            : await executeRest(
                input as unknown as Parameters<typeof executeRest>[0],
                environment,
              );
        return Response.json({ result });
      }
      child = Bun.spawn([process.execPath, `${import.meta.dir}/worker.ts`], {
        stdin: new Blob([JSON.stringify(input)]),
        stdout: "pipe",
        stderr: "ignore",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: "/tmp",
          NODE_ENV: "production",
        },
      });
      timer = setTimeout(() => child?.kill("SIGKILL"), 25_000);
      if (!(child.stdout instanceof ReadableStream))
        throw new Error("Connector output is unavailable");
      const reader = child.stdout.getReader();
      const decoder = new TextDecoder();
      let output = "";
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1_000_000) throw new Error("Connector result too large");
          output += decoder.decode(value, { stream: true });
        }
        output += decoder.decode();
      } finally {
        await reader.cancel();
      }

      const code = await child.exited;
      if (code !== 0 || output.length > 1_000_000)
        throw new Error("Execution failed");
      const parsed = JSON.parse(output);
      // Do not forward an access token even if a connector unexpectedly echoes it.
      const safe =
        typeof input.token === "string"
          ? JSON.stringify(parsed).split(input.token).join("[REDACTED]")
          : JSON.stringify(parsed);
      return new Response(safe, {
        headers: { "content-type": "application/json" },
      });
    } catch {
      return Response.json(
        {
          error:
            "Integration failed. Verify the connection and inputs. Side effects may have occurred; do not retry automatically.",
        },
        { status: 502 },
      );
    } finally {
      if (timer) clearTimeout(timer);
      child?.kill();
      active--;
    }
  };
}

if (import.meta.main) {
  Bun.serve({
    hostname: "0.0.0.0",
    port: Number(process.env.PORT ?? 8090),
    fetch: createExecutorHandler(),
    maxRequestBodySize: 1_000_000,
  });
  console.info(JSON.stringify({ type: "integration-executor-ready" }));
}
