import { createFileRoute } from "@tanstack/react-router";
import { ApprovalSettings } from "@/components/approvals/settings";
import { PageShell } from "@/components/layout/page-shell";
import { TeamBotConsents } from "@/components/settings/team-bot-consents";
import { useProductFeature } from "@/lib/deployment/queries";

export const Route = createFileRoute("/_authed/settings/approvals")({
  component: ApprovalsSettingsPage,
});

function ApprovalsSettingsPage() {
  const groups = useProductFeature("groups");
  return (
    <PageShell
      description="Choose when your Agentes ask before they change things. Rules here apply to all of them."
      title="Approvals"
    >
      <ApprovalSettings />
      {groups ? <TeamBotConsents /> : null}
    </PageShell>
  );
}
