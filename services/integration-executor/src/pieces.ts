import allowlist from "./allowlist.json";

type Property = {
  type: string;
  displayName?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: { options?: { value: unknown }[] };
};
type Action = {
  name: string;
  displayName: string;
  description: string;
  props: Record<string, Property>;
  run(context: unknown): Promise<unknown>;
};
type Piece = { actions(): Record<string, Action> };

export function selection(connector: string) {
  if (!Object.hasOwn(allowlist, connector))
    throw new Error("Unknown connector");
  return allowlist[connector as keyof typeof allowlist];
}

export async function loadPiece(connector: string): Promise<Piece> {
  selection(connector);
  // Package names come only from the reviewed, pinned allowlist, never a request.
  const module = await import(`@activepieces/piece-${connector}`);
  const piece = Object.values(module).find(
    (value): value is Piece =>
      !!value && typeof (value as Piece).actions === "function",
  );
  if (!piece) throw new Error("Connector package is unavailable");
  return piece;
}

function schema(prop: Property): Record<string, unknown> {
  const type = prop.type;
  const text = [
    "SHORT_TEXT",
    "LONG_TEXT",
    "RICH_TEXT",
    "DATE_TIME",
    "DROPDOWN",
  ];
  let result: Record<string, unknown>;
  if (text.includes(type)) result = { type: "string" };
  else if (type === "NUMBER") result = { type: "number" };
  else if (type === "CHECKBOX") result = { type: "boolean" };
  else if (type === "ARRAY") result = { type: "array", items: {} };
  else if (type.includes("MULTI_SELECT"))
    result = { type: "array", items: { type: "string" } };
  else if (type === "OBJECT") result = { type: "object" };
  else if (type === "JSON") result = {};
  else if (type === "STATIC_DROPDOWN") {
    const values = prop.options?.options?.map((option) => option.value);
    result = values?.length ? { enum: values } : { type: "string" };
  } else throw new Error(`Unsupported connector property: ${type}`);
  if (prop.description || prop.displayName)
    result.description = prop.description || prop.displayName;
  return result;
}

function inputSchema(action: Action) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, prop] of Object.entries(action.props)) {
    if (prop.type === "MARKDOWN") continue;
    properties[name] = schema(prop);
    if (prop.required && prop.defaultValue === undefined) required.push(name);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

export async function listTools(connector: string) {
  const chosen = selection(connector);
  const actions = (await loadPiece(connector)).actions();
  return [...chosen.read, ...chosen.write].map((name) => {
    const action = actions[name];
    if (!action)
      throw new Error("Reviewed action disappeared from pinned package");
    return {
      name,
      description: `${action.displayName}. ${action.description}`,
      inputSchema: inputSchema(action),
      // Treat every write conservatively; upstream classifications never widen permissions.
      effect: (chosen.read as readonly string[]).includes(name)
        ? "read"
        : "write",
      destructive: !(chosen.read as readonly string[]).includes(name),
    };
  });
}

export async function executePiece(input: {
  connector: string;
  tool: string;
  token: string;
  args: Record<string, unknown>;
}) {
  const tools = await listTools(input.connector);
  if (!tools.some((tool) => tool.name === input.tool))
    throw new Error("Action is not enabled");
  const action = (await loadPiece(input.connector)).actions()[input.tool];
  const propsValue: Record<string, unknown> = {};
  for (const key of Object.keys(input.args)) {
    if (
      !Object.hasOwn(action.props, key) ||
      action.props[key].type === "MARKDOWN"
    )
      throw new Error("Unknown action argument");
  }
  for (const [key, prop] of Object.entries(action.props)) {
    if (prop.type === "MARKDOWN") continue;
    const value = input.args[key] ?? prop.defaultValue;
    if (value === undefined) {
      if (prop.required) throw new Error(`Missing argument: ${key}`);
      continue;
    }
    const shape = schema(prop);
    const expected = shape.type;
    if (
      (expected === "array" && !Array.isArray(value)) ||
      (expected === "object" &&
        (!value || typeof value !== "object" || Array.isArray(value))) ||
      (["string", "number", "boolean"].includes(String(expected)) &&
        typeof value !== expected) ||
      (Array.isArray(shape.enum) && !shape.enum.includes(value))
    )
      throw new Error(`Invalid argument: ${key}`);
    propsValue[key] = value;
  }
  // File/workflow/context services are intentionally unavailable, rather than mocked.
  if (propsValue.download_files === true)
    throw new Error("File downloads are not supported");
  let auth: unknown = { type: "OAUTH2", access_token: input.token, props: {} };
  if (input.connector === "hubspot")
    auth = { type: "CUSTOM_AUTH", props: { access_token: input.token } };
  if (input.connector === "whatsapp") {
    const value = JSON.parse(input.token);
    if (
      typeof value.access_token !== "string" ||
      typeof value.businessAccountId !== "string"
    )
      throw new Error(
        "WhatsApp requires an access token and Business Account ID",
      );
    auth = { type: "CUSTOM_AUTH", props: value };
  }
  const context = new Proxy(
    { auth, propsValue },
    {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        throw new Error(`Unsupported connector context: ${String(key)}`);
      },
    },
  );
  return action.run(context);
}
