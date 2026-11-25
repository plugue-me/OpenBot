import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const envPath = resolve(root, ".env.standalone");
if (!(await Bun.file(envPath).exists())) {
  const password = randomBytes(24).toString("hex");
  await writeFile(
    envPath,
    [
      "# Private local development configuration. Do not commit.",
      `POSTGRES_PASSWORD=${password}`,
      `DATABASE_URL=postgres://openbot:${password}@127.0.0.1:5544/openbot_independent`,
      `KEY_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
      "PORT=3031",
      "SERVER_PORT=3031",
      "OPENBOT_SINGLE_USER=true",
      "OPENBOT_PUBLIC_URL=http://127.0.0.1:3031",
      "OPENBOT_APP_URL=http://127.0.0.1:3031",
      "BOT_PROVIDER=openai",
      "BOT_MODEL=gpt-4.1-mini",
      `TENANT_PACKAGE_DIR=${resolve(root, "examples/fintech")}`,
      `APP_DIST_DIR=${resolve(root, "app/dist")}`,
      "OPENBOT_SELF_HOST_BANNER=false",
      "OPENBOT_GENERATIVE_UI=false",
      "OPENBOT_PROVISION_COMPOSIO=off",
      "COPILOTKIT_TELEMETRY_DISABLED=true",
      "DO_NOT_TRACK=1",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
}
await chmod(envPath, 0o600);
const run = async (cmd: string[]) => {
  const child = Bun.spawn(cmd, {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) throw new Error(`${cmd[0]} ${cmd[1]} failed (${status}).`);
};
await run([
  "docker",
  "compose",
  "--env-file",
  envPath,
  "-f",
  "docker-compose.standalone.yml",
  "up",
  "-d",
  "--wait",
  "postgres",
]);
await run(["bun", `--env-file=${envPath}`, "server/scripts/migrate.ts"]);
if (!(await Bun.file(resolve(root, "app/dist/index.html")).exists()))
  await run(["bun", "run", "--filter", "app", "build"]);
await run(["bun", `--env-file=${envPath}`, "server/src/standalone-entry.ts"]);
