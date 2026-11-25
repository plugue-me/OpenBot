import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { WEB_V1_FEATURES } from "@openbot/shared/product-capabilities";
import { cleanup, render } from "@testing-library/react";
import { Composer } from "../src/components/channels/composer/composer";
import { deploymentKeys } from "../src/lib/deployment/queries";
import { loadVoiceArchive } from "../src/lib/voice/archive";
import { queryClient } from "../src/query-client";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost/" }));
afterEach(() => {
  cleanup();
  queryClient.clear();
});
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

const capabilities = {
  standalone: true,
  features: WEB_V1_FEATURES,
  generativeUi: false,
  selfHostBanner: false,
  localEvaluation: true,
  edition: "team" as const,
  transcription: false,
  voice: false,
};

test("the V1 composer offers text without voice, dictation or unsupported attachments", () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), capabilities);
  const view = render(<Composer onSubmit={() => {}} />);
  expect(view.getByRole("textbox", { name: "Message" })).toBeDefined();
  expect(view.queryByRole("button", { name: "Dictate a message" })).toBeNull();
  expect(view.queryByRole("button", { name: "Attach a file" })).toBeNull();
  expect(view.queryByRole("button", { name: "Set up a routine" })).toBeNull();
});

test("text turns do not fetch the removed voice history endpoint", async () => {
  queryClient.setQueryData(deploymentKeys.capabilities(), capabilities);
  const fetch = spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("No network expected"),
  );
  try {
    await loadVoiceArchive("new-channel");
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
