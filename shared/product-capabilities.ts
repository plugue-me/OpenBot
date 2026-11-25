/** Product scope is separate from authorization: enabling a feature never grants access to data. */
export const FEATURE_STATES = [
  "available",
  "unavailable",
  "in_development",
  "out_of_scope",
] as const;
export type FeatureState = (typeof FEATURE_STATES)[number];

export const WEB_V1_FEATURES = {
  chat: { state: "available", label: "Conversas" },
  agents: { state: "available", label: "Funcionários" },
  vault: { state: "available", label: "Credenciais" },
  audit: { state: "available", label: "Auditoria" },
  users: { state: "available", label: "Usuários" },
  groups: { state: "in_development", label: "Conversas em grupo" },
  delegation: { state: "in_development", label: "Delegação" },
  tasks: { state: "in_development", label: "Tarefas" },
  routines: { state: "in_development", label: "Rotinas" },
  goals: { state: "in_development", label: "Metas" },
  checkIns: { state: "in_development", label: "Check-ins" },
  memory: { state: "in_development", label: "Memória" },
  knowledge: { state: "in_development", label: "Conhecimento compartilhado" },
  skills: { state: "in_development", label: "Skills" },
  mcp: { state: "in_development", label: "Conexões MCP" },
  approvals: { state: "in_development", label: "Aprovações" },
  computer: { state: "in_development", label: "Computador do funcionário" },
  files: { state: "in_development", label: "Arquivos" },
  modelSelection: { state: "in_development", label: "Seleção de modelo" },
  usage: { state: "in_development", label: "Consumo de IA" },
  governance: { state: "in_development", label: "Políticas de execução" },
  notifications: { state: "in_development", label: "Notificações" },
  personalization: {
    state: "in_development",
    label: "Perfil e instruções pessoais",
  },
  reset: { state: "in_development", label: "Redefinir funcionário" },
  voice: { state: "out_of_scope", label: "Voz" },
  dictation: { state: "out_of_scope", label: "Ditado" },
  recorder: { state: "out_of_scope", label: "Recorder" },
  learning: { state: "out_of_scope", label: "Automatic Learning" },
  desktop: { state: "out_of_scope", label: "Aplicativo desktop" },
  nativeMobile: { state: "out_of_scope", label: "Aplicativo mobile" },
  extension: { state: "out_of_scope", label: "Extensão" },
  brokers: { state: "out_of_scope", label: "Composio e Arcade" },
  externalChannels: { state: "out_of_scope", label: "Slack e Teams" },
  inspector: { state: "out_of_scope", label: "Inspector" },
  externalTelemetry: { state: "out_of_scope", label: "Telemetria externa" },
} as const satisfies Record<string, { state: FeatureState; label: string }>;
export type ProductFeature = keyof typeof WEB_V1_FEATURES;
export type ProductFeatures = Record<
  ProductFeature,
  { state: FeatureState; label: string }
>;

/** One path map for navigation, direct URL access and the API boundary. Exact segment matching. */
export function productFeatureForPath(
  path: string,
): ProductFeature | undefined {
  const p = path.replace(/\/+$/, "") || "/";
  const match = (part: string) => p === part || p.startsWith(`${part}/`);
  if (
    ["/api/auth/desktop", "/api/auth/electron", "/api/host-access"].some(match)
  )
    return "desktop";
  if (["/api/auth/expo", "/api/mobile"].some(match)) return "nativeMobile";
  if (p.startsWith("/api/copilotkit/trajectory/")) return "recorder";
  if (
    [
      "/api/copilotkit/inspector-metadata",
      "/api/copilotkit/inspector-learning",
    ].some(match)
  )
    return "inspector";
  if (["/api/voice", "/voice"].some(match)) return "voice";
  if (
    ["/api/transcribe", "/api/dictation", "/api/copilotkit/transcribe"].some(
      match,
    )
  )
    return "dictation";
  if (["/api/recorder", "/recordings"].some(match)) return "recorder";
  if (["/api/learning", "/settings/learning", "/admin/learning"].some(match))
    return "learning";
  if (["/api/desktop", "/download"].some(match)) return "desktop";
  if (["/api/slack", "/api/teams"].some(match)) return "externalChannels";
  if (["/api/composio", "/api/arcade"].some(match)) return "brokers";
  if (["/admin/providers", "/settings/setup", "/api/models"].some(match))
    return "modelSelection";
  if (["/admin/computers"].some(match)) return "computer";
  if (["/admin/skills"].some(match)) return "skills";
  if (["/admin/plugins"].some(match)) return "mcp";
  if (["/admin/proactive"].some(match)) return "checkIns";
  if (
    [
      "/admin/boundaries",
      "/admin/what-if",
      "/admin/permissions",
      "/admin/identity-providers",
    ].some(match)
  )
    return "governance";
  if (["/settings/notifications"].some(match)) return "notifications";
  if (["/team-bots", "/api/team-bots"].some(match)) return "groups";
  if (["/routines", "/api/routines", "/internal/routines"].some(match))
    return "routines";
  if (["/memory", "/api/memory"].some(match)) return "memory";
  if (["/skills", "/api/skills"].some(match)) return "skills";
  if (["/connections", "/api/plugins", "/api/mcp"].some(match)) return "mcp";
  if (["/tasks", "/api/tasks"].some(match)) return "tasks";
  if (["/goals", "/api/responsibilities"].some(match)) return "goals";
  if (["/api/proactive", "/check-ins"].some(match)) return "checkIns";
  if (
    [
      "/approvals",
      "/settings/approvals",
      "/admin/approvals",
      "/api/approvals",
    ].some(match)
  )
    return "approvals";
  if (["/settings/computer", "/api/computers", "/api/browser"].some(match))
    return "computer";
  const botSetting =
    /^\/(?:bots|api\/agents)\/[^/]+\/(memory|routines|skills|apps|approvals|reach|sharing|computer|reset)(?:\/|$)/.exec(
      p,
    )?.[1];
  if (botSetting)
    return (
      {
        memory: "memory",
        routines: "routines",
        skills: "skills",
        apps: "mcp",
        approvals: "approvals",
        reach: "externalChannels",
        sharing: "groups",
        computer: "computer",
        reset: "reset",
      } as const
    )[
      botSetting as
        | "memory"
        | "routines"
        | "skills"
        | "apps"
        | "approvals"
        | "reach"
        | "sharing"
        | "computer"
        | "reset"
    ];
  return undefined;
}

/** Missing server facts must never enable an action. Legacy deployments use their original UI. */
export function productFeatureAvailable(
  features: ProductFeatures | undefined,
  feature: ProductFeature,
): boolean {
  return features?.[feature]?.state === "available";
}
