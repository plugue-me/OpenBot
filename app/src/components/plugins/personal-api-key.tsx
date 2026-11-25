import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { client } from "@/lib/client";
import { invalidatePlugins } from "@/lib/plugins/mutations";
import { connectionsQueryOptions } from "@/lib/plugins/queries";

/** Uses the original connector page; keys never enter query caches or URLs. */
export function PersonalApiKey({ serverId }: { serverId: string }) {
  const [key, setKey] = useState("");
  const queryClient = useQueryClient();
  const connections = useQuery(connectionsQueryOptions());
  const saved = connections.data?.connections.some(
    (item) => item.serverId === serverId && !item.revoked,
  );
  const mutation = useMutation({
    mutationFn: (remove: boolean) =>
      client(`/api/plugins/servers/${encodeURIComponent(serverId)}/api-key`, {
        method: remove ? "DELETE" : "POST",
        ...(remove ? {} : { body: { key } }),
        fallback: "Could not update your API key.",
      }),
    onSuccess: async () => {
      setKey("");
      await invalidatePlugins(queryClient);
      await queryClient.invalidateQueries({
        queryKey: connectionsQueryOptions().queryKey,
      });
    },
  });
  return (
    <div className="space-y-3 p-3">
      <p className="text-sm">Your API key</p>
      <p className="text-muted-foreground text-xs">
        {saved
          ? "Saved in your encrypted Vault. This does not verify access at the provider."
          : "Each person connects their own account. The key stays in the encrypted Vault."}{" "}
        Removing it here blocks Plugueme access; revoke it at the provider too.
      </p>
      {serverId === "integration-whatsapp" ? (
        <p className="text-xs">
          Use JSON with access_token and businessAccountId. Renew the Meta token
          manually when needed.
        </p>
      ) : null}
      <Input
        aria-label="Your API key"
        autoComplete="off"
        type="password"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!key.trim() || mutation.isPending}
          onClick={() => mutation.mutate(false)}
        >
          Save key
        </Button>
        {saved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(true)}
          >
            Remove key
          </Button>
        ) : null}
      </div>
      {connections.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not read connection state.
        </p>
      ) : null}
      {mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}
    </div>
  );
}
