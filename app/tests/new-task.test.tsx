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
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewTaskButton } from "../src/components/tasks/new-task-button";
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

function draw(standalone = true) {
  queryClient.setQueryData(deploymentKeys.capabilities(), {
    standalone,
    features: WEB_V1_FEATURES,
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({ component: NewTaskButton }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("manual task creation is offered only on the standalone composition that implements it", async () => {
  const view = draw(false);
  await settleReactWork();
  expect(view.queryByRole("button", { name: "New task" })).toBeNull();
});

test("retry after a lost confirmation keeps the same task identity and instruction", async () => {
  const submitted: Record<string, string>[] = [];
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/agents")
        return Response.json({
          agents: [{ id: "bot", name: "Local Bot", endpoint: null }],
        });
      if (path === "/api/tasks" && init?.method === "POST") {
        submitted.push(JSON.parse(String(init.body)));
        if (submitted.length === 1) throw new Error("Lost confirmation");
        return Response.json(
          { task: { id: "task", channelId: "task-channel" } },
          { status: 201 },
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    },
    { preconnect: originalFetch.preconnect },
  );
  const view = draw();
  const user = userEvent.setup({ document });
  await user.click(await view.findByRole("button", { name: "New task" }));
  await user.click(view.getByRole("combobox", { name: "Bot" }));
  await user.click(await view.findByRole("option", { name: "Local Bot" }));
  await user.type(view.getByLabelText("Title"), "Prepare report");
  await user.type(view.getByLabelText("What to do"), "Write a brief report.");
  await user.click(view.getByRole("button", { name: "Start task" }));
  await view.findByRole("alert");
  expect(view.getByLabelText("What to do").hasAttribute("disabled")).toBe(true);
  await user.click(view.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(submitted).toHaveLength(2));
  expect(submitted[0]).toEqual(submitted[1]);
  expect(submitted[0]?.requestId).toMatch(/^[0-9a-f-]{36}$/);
});
