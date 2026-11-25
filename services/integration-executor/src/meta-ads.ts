/** Own connector: the reviewed Community tree has Facebook Leads, not a Meta Ads piece. */
export const metaAdsTools = ["list_campaigns", "get_insights"].map((name) => ({
  name,
  description:
    name === "list_campaigns"
      ? "List campaigns in a Meta ad account. No budget changes."
      : "Read Meta ad account performance insights.",
  inputSchema: {
    type: "object",
    properties: {
      account_id: {
        type: "string",
        description: "Numeric Meta ad account ID, without act_",
      },
    },
    required: ["account_id"],
    additionalProperties: false,
  },
  effect: "read",
  destructive: false,
}));

export async function executeMetaAds(input: {
  tool: string;
  token: string;
  args: Record<string, unknown>;
}) {
  if (
    !metaAdsTools.some((tool) => tool.name === input.tool) ||
    typeof input.args.account_id !== "string" ||
    !/^\d{1,32}$/.test(input.args.account_id) ||
    Object.keys(input.args).length !== 1
  )
    throw new Error("Invalid Meta Ads request");
  const campaigns = input.tool === "list_campaigns";
  const url = new URL(
    `https://graph.facebook.com/v23.0/act_${input.args.account_id}/${campaigns ? "campaigns" : "insights"}`,
  );
  url.searchParams.set(
    "fields",
    campaigns
      ? "id,name,status,objective"
      : "account_id,impressions,clicks,spend,date_start,date_stop",
  );
  url.searchParams.set("limit", "25");
  if (!campaigns) url.searchParams.set("date_preset", "last_7d");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${input.token}` },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Meta Ads refused request");
  const result = (await response.json()) as {
    data?: unknown;
    paging?: { cursors?: unknown };
  };
  // Meta paging.next can contain the token. Return cursor values only.
  return { data: result.data, cursors: result.paging?.cursors };
}
