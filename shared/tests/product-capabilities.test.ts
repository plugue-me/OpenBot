import { expect, test } from "bun:test";
import {
  productFeatureAvailable,
  productFeatureForPath,
  WEB_V1_FEATURES,
} from "../product-capabilities";

test("scope checks use complete path segments and match employee subpages", () => {
  expect(productFeatureForPath("/api/voice/sessions")).toBe("voice");
  expect(productFeatureForPath("/api/voicemail")).toBeUndefined();
  expect(productFeatureForPath("/api/routines-extra")).toBeUndefined();
  expect(productFeatureForPath("/bots/example/reach")).toBe("externalChannels");
  expect(productFeatureForPath("/admin/learning/")).toBe("learning");
  expect(productFeatureForPath("/api/copilotkit/transcribe")).toBe("dictation");
  expect(productFeatureForPath("/api/agents/example/reset")).toBe("reset");
});

test("an unavailable or unknown capability cannot enable a tool", () => {
  expect(productFeatureAvailable(undefined, "computer")).toBe(false);
  expect(productFeatureAvailable(WEB_V1_FEATURES, "computer")).toBe(false);
  expect(productFeatureAvailable(WEB_V1_FEATURES, "learning")).toBe(false);
  expect(productFeatureAvailable(WEB_V1_FEATURES, "chat")).toBe(true);
});
