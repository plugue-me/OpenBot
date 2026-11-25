// Apply the SDK's documented telemetry opt-out before importing any runtime module.
export {};

process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
process.env.DO_NOT_TRACK = "1";
for (const name of [
  "CPK_INTELLIGENCE_API_KEY",
  "INTELLIGENCE_API_KEY",
  "COPILOTKIT_LICENSE_TOKEN",
  "OPENBOT_LICENSE",
  "INTELLIGENCE_API_URL",
  "INTELLIGENCE_GATEWAY_WS_URL",
])
  delete process.env[name];
const { startStandalone } = await import("./standalone/bootstrap");
await startStandalone();
