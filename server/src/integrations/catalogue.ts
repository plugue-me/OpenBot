import type { CatalogueAuth, CatalogueEntry } from "../plugins/catalogue";

const google = (scopes: string[]): CatalogueAuth => ({
  kind: "user-oauth",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  revokeUrl: "https://oauth2.googleapis.com/revoke",
  scopes: scopes.map((scope) => `https://www.googleapis.com/auth/${scope}`),
  authorizationParams: { access_type: "offline", prompt: "consent" },
});
const key: CatalogueAuth = { kind: "person-key" };
// A reference, never a dialled network URL. The operator configures the backend separately.
export const INTEGRATION_CATALOGUE: readonly CatalogueEntry[] = [
  ["gmail", "Gmail", google(["gmail.readonly", "gmail.modify"])],
  [
    "google-calendar",
    "Google Calendar",
    google(["calendar.events", "calendar.calendarlist.readonly"]),
  ],
  ["google-drive", "Google Drive", google(["drive"])],
  ["google-sheets", "Google Sheets", google(["spreadsheets"])],
  ["google-ads", "Google Ads", google(["adwords"])],
  // Meta does not issue a standard OAuth refresh token. Do not misrepresent it as that flow.
  ["facebook-pages", "Facebook Pages", key],
  ["meta-ads", "Meta Ads", key],
  ["instagram-business", "Instagram Business", key],
  ["whatsapp", "WhatsApp Business", key],
  ["hubspot", "HubSpot", key],
  ["rest", "Custom REST API", key],
].map(([id, title, auth]) => ({
  key: `integration-${id}`,
  title: title as string,
  vendor: "Plugueme",
  summary:
    id === "whatsapp"
      ? "Your Meta System User token and Business Account ID, stored as JSON. Manual token renewal."
      : "Your account through the internal integration executor. Permissions and approvals apply to every call.",
  host: `integration://${id}`,
  path: "/",
  transport: "integrations",
  auth: auth as CatalogueAuth,
  // No action becomes a reviewed read simply because its name was omitted here.
  writeTools: [],
  readTools: id === "rest" ? ["get"] : [],
  docsUrl:
    "https://github.com/activepieces/activepieces/tree/main/packages/pieces/community",
}));
