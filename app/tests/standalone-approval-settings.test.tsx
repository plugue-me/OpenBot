import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { WEB_V1_FEATURES } from "@openbot/shared/product-capabilities";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import { ApprovalSettings } from "../src/components/approvals/settings";
import { deploymentKeys } from "../src/lib/deployment/queries";
import { queryClient } from "../src/query-client";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost/" }));
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  queryClient.clear();
  globalThis.fetch = originalFetch;
});
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

test("standalone approval settings offer MCP policy without desktop or unconfigured reviewer controls", async () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), {
    standalone: true,
    edition: "team",
    features: WEB_V1_FEATURES,
  });
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/approvals")
        return Response.json({
          enabled: true,
          preferences: {
            enabled: true,
            autoReview: false,
            hostCommands: "ask",
          },
          team: {},
          rules: [],
          teamRules: [],
          requests: [],
          questions: [],
        });
      if (path.startsWith("/api/agents")) return Response.json({ agents: [] });
      if (path === "/api/me") return Response.json({ role: "admin" });
      throw new Error(`Unexpected request ${path}`);
    },
    { preconnect: originalFetch.preconnect },
  );
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({ component: ApprovalSettings }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
  await view.findByText(/MCP calls are checked against permissions/);
  expect(view.getByRole("switch", { name: "Extra vigilant" })).toBeDefined();
  expect(view.queryByText("Auto-review")).toBeNull();
  expect(view.queryByText("Commands on your computer")).toBeNull();
  expect(view.queryByText("Admin → Approvals")).toBeNull();
});
