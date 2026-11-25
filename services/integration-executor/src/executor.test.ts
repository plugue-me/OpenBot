import { expect, test } from "bun:test";
import { executePiece, listTools } from "./pieces";
import { createExecutorHandler } from "./server";

test("only pinned connectors and reviewed actions are advertised", async () => {
  for (const connector of [
    "gmail",
    "google-calendar",
    "google-drive",
    "google-sheets",
    "google-ads",
    "facebook-pages",
    "instagram-business",
    "whatsapp",
    "hubspot",
  ]) {
    const tools = await listTools(connector);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((tool) => tool.name === "custom_api_call")).toBe(false);
    expect(
      tools.every((tool) => tool.inputSchema.additionalProperties === false),
    ).toBe(true);
  }
  await expect(listTools("../../ee")).rejects.toThrow();
  await expect(
    executePiece({
      connector: "gmail",
      tool: "gmail_get_profile",
      token: "synthetic",
      args: { auth: "override" },
    }),
  ).rejects.toThrow("Unknown action argument");
  await expect(
    executePiece({
      connector: "gmail",
      tool: "gmail_get_message",
      token: "synthetic",
      args: {},
    }),
  ).rejects.toThrow("Missing argument");
});

test("executor authenticates before discovery or execution and does not expose vendor errors", async () => {
  const secret = "synthetic-internal-key-with-at-least-32-characters";
  const handler = createExecutorHandler({
    PLUGUEME_INTEGRATION_SECRET: secret,
  });
  const url = "http://executor/v1/connectors/rest/tools";
  expect((await handler(new Request(url))).status).toBe(401);
  const headers = {
    authorization: `Bearer ${secret}`,
    "content-type": "application/json",
  };
  const listing = await handler(new Request(url, { headers }));
  expect(listing.status).toBe(200);
  expect(
    (await listing.json()).result.map((tool: { name: string }) => tool.name),
  ).toEqual(["get", "post", "put", "patch", "delete"]);
  const gmail = await handler(
    new Request("http://executor/v1/connectors/gmail/tools", { headers }),
  );
  expect(gmail.status).toBe(200);
  expect(
    (await gmail.json()).result.some(
      (tool: { name: string }) => tool.name === "gmail_get_profile",
    ),
  ).toBe(true);
  const error = await handler(
    new Request("http://executor/v1/connectors/rest/call", {
      headers,
      method: "POST",
      body: JSON.stringify({
        token: "do-not-leak",
        tool: "get",
        args: { path: "https://evil.example" },
      }),
    }),
  );
  expect(error.status).toBe(502);
  expect(await error.text()).not.toContain("do-not-leak");
});
