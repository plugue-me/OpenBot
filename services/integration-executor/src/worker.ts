import { executePiece, listTools } from "./pieces";

// One process per operation: tokens stay out of argv, environment, logs and persistent state.
const input = await Bun.stdin.json();
try {
  const result =
    input.operation === "list"
      ? await listTools(input.connector)
      : await executePiece(input);
  process.stdout.write(JSON.stringify({ result }));
} catch {
  // Vendor errors can contain credential-bearing request objects. Never return them verbatim.
  process.stdout.write(
    JSON.stringify({
      error:
        "Connector refused or failed; verify inputs, permissions and connection.",
    }),
  );
  process.exitCode = 1;
}
