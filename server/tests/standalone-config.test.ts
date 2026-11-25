import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../src/config";
import { builtInAgentConfiguration } from "../src/copilot";

test("standalone has no remote credential contract and retains single-user exposure checks", () => {
  const environment = {
    KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    DATABASE_URL: "postgres://localhost/unused",
    OPENBOT_SINGLE_USER: "true",
  };
  const runtime = { mode: "standalone", durableHistory: true } as const;
  expect(loadConfig(environment, runtime).runtime).toEqual(runtime);
  expect(() =>
    loadConfig(
      { ...environment, OPENBOT_PUBLIC_URL: "https://public.example.com" },
      runtime,
    ),
  ).toThrow();
});

test("the server-owned standalone output limit reaches the provider configuration", () => {
  expect(
    builtInAgentConfiguration(
      {
        id: "budget-test",
        name: "Budget test",
        type: "built_in",
        systemPrompt: "Reply briefly",
      },
      {
        provider: "openai",
        defaultModel: "gpt-4.1-mini",
        maxOutputTokens: 256,
      },
      "synthetic-key",
    ),
  ).toMatchObject({ maxOutputTokens: 256 });
});
