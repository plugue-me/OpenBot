import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { BotRoster } from "@/components/bots/bot-roster";
import { type AgentProfile, agentKeys } from "@/lib/agents/queries";
import { deploymentKeys } from "@/lib/deployment/queries";
import { settleReactWork } from "./settle-react-work";

/**
 * The Agentes roster: one list of every Agente a person can reach, replacing the Agentes, Agents and Team
 * Agentes screens. The harness is this repository's: `GlobalRegistrator` around the file, `cleanup`
 * after each test, a `QueryClient` per test with `retry: false`, and `fetch` stubbed per test.
 */

beforeAll(() => GlobalRegistrator.register());
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function bot(overrides: Partial<AgentProfile> & { id: string }): AgentProfile {
  return {
    assignedToMe: false,
    runsOnOpenBotModel: false,
    keyFromOpenBot: false,
    name: overrides.id,
    title: "Title",
    roleDescription: "Role",
    avatarSeed: "seed",
    visibility: "private",
    endpoint: null,
    builtIn: true,
    hasAuth: false,
    hasCallbackToken: false,
    isolated: false,
    isolationActive: false,
    isolationOffReason: null,
    hidden: false,
    pinned: false,
    systemOwned: false,
    canManage: true,
    mine: true,
    ...overrides,
  };
}

/**
 * Serves the visible roster, the hidden roster, and an empty attention list, with nothing found by
 * check-ins and no tasks.
 */
function serving(
  visible: AgentProfile[],
  hidden: AgentProfile[],
  attention: Record<string, unknown>[] = [],
) {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/bots/attention"))
      return Response.json({ bots: attention, lastPingId: null });
    if (url === "/api/proactive/suggestions")
      return Response.json({ suggestions: [] });
    if (url === "/api/tasks") return Response.json({ tasks: [] });
    if (url.startsWith("/api/channels"))
      return Response.json({ channels: [], nextCursor: null });
    return Response.json({
      agents: url.includes("hidden=true") ? hidden : visible,
    });
  }) as unknown as typeof fetch;
}

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

function draw() {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: BotRoster,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/bots/$agentId",
      component: () => null,
    }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );
}

test("sections read Pinned, Yours, Shared with you, and each Agente appears once", async () => {
  serving(
    [
      bot({ id: "favourite", name: "Favourite", pinned: true }),
      bot({ id: "mine", name: "Mine" }),
      bot({ id: "theirs", name: "Theirs", mine: false, canManage: false }),
    ],
    [],
  );
  const view = draw();
  expect(await view.findByText("Theirs")).toBeTruthy();
  const headings = [...view.container.querySelectorAll("h2")].map(
    (heading) => heading.textContent,
  );
  expect(headings).toEqual(["Pinned", "Yours", "Shared with you"]);
  expect(view.getAllByText("Favourite")).toHaveLength(1);
});

test("a row opens the Agente's own page", async () => {
  serving([bot({ id: "mine", name: "Mine" })], []);
  const view = draw();
  const row = (await view.findByText("Mine")).closest("a");
  expect(row?.getAttribute("href")).toBe("/bots/mine");
});

test("with every Agente of yours pinned, there is no empty Yours, only the way to make another", async () => {
  serving([bot({ id: "favourite", name: "Favourite", pinned: true })], []);
  const view = draw();
  expect(await view.findByText("Favourite")).toBeTruthy();
  expect(view.queryByRole("heading", { name: "Yours" })).toBeNull();
  expect(view.queryByText("All pinned")).toBeNull();
  expect(view.getByText(/^Create a Agente for a specific job\./)).toBeTruthy();
});

test("a hidden Agente is under Hidden, folded until asked for, and its row opens its page", async () => {
  serving(
    [bot({ id: "mine", name: "Mine" })],
    [bot({ id: "tucked", name: "Tucked", hidden: true })],
  );
  const view = draw();
  expect(await view.findByText("Hidden")).toBeTruthy();
  expect(view.queryByText("Tucked")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Show" }));
  const row = view.getByText("Tucked").closest("a");
  expect(row?.getAttribute("href")).toBe("/bots/tucked");
});

test("with nothing hidden there is no Hidden section", async () => {
  serving([bot({ id: "mine", name: "Mine" })], []);
  const view = draw();
  expect(await view.findByText("Mine")).toBeTruthy();
  await waitFor(() =>
    expect(queryClient.getQueryState(agentKeys.list(true))?.status).toBe(
      "success",
    ),
  );
  expect(view.queryByText("Hidden")).toBeNull();
});

test("a roster that never loaded says so, not that you have no Agentes", async () => {
  global.fetch = (async () =>
    new Response(null, { status: 500 })) as unknown as typeof fetch;
  const view = draw();
  expect(await view.findByRole("alert")).toBeTruthy();
  expect(
    view.queryByText(
      "You don't have any Agentes yet. Create one with New Agente.",
    ),
  ).toBeNull();
});

test("a failed refetch keeps the roster it already had, not the error", async () => {
  queryClient.setQueryData(agentKeys.list(false), [
    bot({ id: "mine", name: "Mine" }),
  ]);
  global.fetch = (async () =>
    new Response(null, { status: 500 })) as unknown as typeof fetch;
  const view = draw();
  await waitFor(() =>
    expect(queryClient.getQueryState(agentKeys.list(false))?.status).toBe(
      "error",
    ),
  );
  expect(view.getByText("Mine")).toBeTruthy();
  expect(
    view.queryByText("Couldn't load your Agentes. Reload the page."),
  ).toBeNull();
});

test("a Agente with something waiting stays in its own section, with its count", async () => {
  serving(
    [
      bot({ id: "mine", name: "Mine" }),
      bot({ id: "waiting", name: "Waiting", mine: false }),
    ],
    [],
    [
      {
        agentId: "waiting",
        name: "Waiting",
        questions: 1,
        approvals: 1,
        handoffs: 0,
        unread: 0,
        paused: false,
        notify: "all",
        items: 0,
        tasks: { needsInput: 0, ready: 0, failed: 0 },
      },
    ],
  );
  const view = draw();
  expect(await view.findByText("2")).toBeTruthy();
  const headings = [...view.container.querySelectorAll("h2")].map(
    (heading) => heading.textContent,
  );
  // What it waits on is on the Needs you board, by name; the Agente itself stays where it is.
  expect(headings).toEqual(["Yours", "Shared with you"]);
  expect(view.getAllByText("Waiting")).toHaveLength(1);
});

test("a Agente's check-in items are counted in the words the badge and Needs you use", async () => {
  serving(
    [bot({ id: "scout", name: "Scout", mine: false })],
    [],
    [
      {
        agentId: "scout",
        name: "Scout",
        questions: 0,
        approvals: 0,
        handoffs: 0,
        unread: 0,
        paused: false,
        notify: "all",
        items: 2,
        tasks: { needsInput: 0, ready: 0, failed: 0 },
      },
    ],
  );
  const view = draw();
  expect(await view.findByText("2 things need you")).toBeTruthy();
  expect(view.container.textContent).not.toContain("suggestion");
});

test("personal edition labels starter Agentes as included with OpenBot", async () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), {
    edition: "personal",
  });
  serving(
    [bot({ id: "starter", name: "Starter", mine: false, systemOwned: true })],
    [],
  );
  const view = draw();
  await view.findByText("Starter");
  expect(
    view.getByRole("heading", { name: "Included with OpenBot" }),
  ).toBeTruthy();
  expect(view.queryByText("Shared with you")).toBeNull();
});

test("while the roster loads it draws rows' shape, and never says there are no Agentes", async () => {
  serving([bot({ id: "mine", name: "Mine" })], []);
  const served = global.fetch;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    await gate;
    return served(input, init);
  }) as typeof fetch;
  const view = draw();
  expect(
    await view.findByRole("status", { name: "Loading your Agentes" }),
  ).toBeTruthy();
  expect(view.queryByText("No Agentes yet")).toBeNull();

  release();
  expect(await view.findByText("Mine")).toBeTruthy();
  expect(
    view.queryByRole("status", { name: "Loading your Agentes" }),
  ).toBeNull();
});

const headings = (view: ReturnType<typeof draw>) =>
  [...view.container.querySelectorAll("h2")].map(
    (heading) => heading.textContent,
  );

test("personal, with only the included assistant: the assistant comes first and nothing says No Agentes yet", async () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), {
    edition: "personal",
  });
  serving(
    [
      bot({
        id: "assistant",
        name: "Personal Assistant",
        mine: false,
        systemOwned: true,
      }),
    ],
    [],
  );
  const view = draw();
  const assistant = await view.findByText("Personal Assistant");
  expect(headings(view)).toEqual(["Included with OpenBot"]);
  expect(view.queryByText("No Agentes yet")).toBeNull();
  // The way to make one comes after the Agente that is already there.
  const prompt = view.getByText(/^Create a Agente for a specific job\./);
  expect(
    assistant.compareDocumentPosition(prompt) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    view.getByRole("link", { name: "New Agente" }).getAttribute("href"),
  ).toBe("/bots?new=true");
});

test("owned and included Agentes: Yours, then Included with OpenBot, and no creation prompt", async () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), {
    edition: "personal",
  });
  serving(
    [
      bot({ id: "mine", name: "Mine" }),
      bot({
        id: "assistant",
        name: "Assistant",
        mine: false,
        systemOwned: true,
      }),
    ],
    [],
  );
  const view = draw();
  await view.findByText("Assistant");
  expect(headings(view)).toEqual(["Yours", "Included with OpenBot"]);
  expect(view.queryByText(/^Create a Agente for a specific job\./)).toBeNull();
});

test("a team member with only shared Agentes sees them, with no empty Yours above", async () => {
  serving([bot({ id: "theirs", name: "Theirs", mine: false })], []);
  const view = draw();
  await view.findByText("Theirs");
  expect(headings(view)).toEqual(["Shared with you"]);
  expect(view.queryByText("No Agentes yet")).toBeNull();
  expect(view.getByText(/^Create a Agente for a specific job\./)).toBeTruthy();
});

test("with no Agentes anywhere there is one empty state, with New Agente", async () => {
  serving([], []);
  const view = draw();
  expect(await view.findByText("No Agentes yet")).toBeTruthy();
  expect(headings(view)).toEqual([]);
  expect(
    view.getAllByText(/Create a Agente for a specific job\./),
  ).toHaveLength(1);
  expect(view.getByRole("button", { name: "New Agente" })).toBeTruthy();
  expect(view.queryByText("Nothing shared yet")).toBeNull();
});

test("with every Agente hidden it doesn't claim there are none", async () => {
  serving([], [bot({ id: "tucked", name: "Tucked", hidden: true })]);
  const view = draw();
  expect(await view.findByText("No Agentes on your list")).toBeTruthy();
  expect(view.queryByText("No Agentes yet")).toBeNull();
  expect(view.getByText("Hidden")).toBeTruthy();
});
