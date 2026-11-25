import { productFeatureAvailable } from "@openbot/shared/product-capabilities";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { ClientError } from "@/lib/client";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { createTaskMutationOptions } from "@/lib/tasks/mutations";
import type { BotTask } from "@/lib/tasks/queries";
import { queryClient } from "@/query-client";

export function NewTaskButton() {
  const { data } = useQuery(deploymentCapabilitiesQueryOptions());
  if (!data?.standalone || !productFeatureAvailable(data.features, "tasks"))
    return null;
  return <AvailableNewTaskButton />;
}

function AvailableNewTaskButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const agents = useQuery({ ...agentListQueryOptions(), enabled: open });
  const create = useMutation(createTaskMutationOptions(queryClient));
  const bots = agents.data?.filter((agent) => !agent.endpoint) ?? [];
  const submit = async () => {
    setSubmitted(true);
    let task: BotTask;
    try {
      task = await create.mutateAsync({
        requestId,
        agentId,
        title,
        instruction,
      });
    } catch (error) {
      // A definite rejection permits correction. Ambiguous delivery keeps the same immutable ask.
      if (
        error instanceof ClientError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 409
      ) {
        setSubmitted(false);
        setRequestId(crypto.randomUUID());
      }
      throw error;
    }
    setOpen(false);
    setRequestId(crypto.randomUUID());
    setSubmitted(false);
    setTitle("");
    setInstruction("");
    await navigate({
      to: "/channel/$channelId",
      params: { channelId: task.channelId },
    });
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <IconPlus />
        New task
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!create.isPending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Choose a Bot and describe the work. Its result appears in a
              separate conversation, even when this page is closed.
            </DialogDescription>
          </DialogHeader>
          <form
            id="new-task"
            onSubmit={(event) => {
              event.preventDefault();
              void submit().catch(() => {});
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="task-bot">Bot</FieldLabel>
                <Select
                  value={agentId || null}
                  onValueChange={(value) => setAgentId(value ?? "")}
                  disabled={submitted}
                >
                  <SelectTrigger id="task-bot">
                    <SelectValue placeholder="Choose a Bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {bots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-title">Title</FieldLabel>
                <Input
                  id="task-title"
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitted}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-instruction">What to do</FieldLabel>
                <Textarea
                  id="task-instruction"
                  required
                  maxLength={6000}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={submitted}
                />
              </Field>
            </FieldGroup>
          </form>
          {agents.error ? (
            <p role="alert">Couldn't load your Bots. Reopen to try again.</p>
          ) : null}
          {open && !agents.isPending && !agents.error && bots.length === 0 ? (
            <p>Create a built-in Bot before starting a task.</p>
          ) : null}
          {create.error ? (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={create.isPending}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              type="submit"
              form="new-task"
              disabled={
                create.isPending ||
                !agentId ||
                !title.trim() ||
                !instruction.trim()
              }
            >
              {create.isPending
                ? "Starting…"
                : create.error
                  ? "Retry"
                  : "Start task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
