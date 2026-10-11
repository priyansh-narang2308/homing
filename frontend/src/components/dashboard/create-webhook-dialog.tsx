import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWebhook } from "@/hooks/use-api";
import type { WebhookEndpoint } from "@/lib/types";

const AVAILABLE_EVENTS = [
  {
    id: "email.sent",
    label: "email.sent",
    description: "Triggered when email is delivered successfully",
  },
  {
    id: "email.failed",
    label: "email.failed",
    description: "Triggered when an attempt fails and will be retried",
  },
  {
    id: "email.dlq",
    label: "email.dlq",
    description: "Triggered when max attempts are exhausted and sent to DLQ",
  },
];

export function CreateWebhookDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (endpoint: WebhookEndpoint) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const createWebhook = useCreateWebhook();

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setUrl("");
      setDescription("");
      setSelectedEvents(["*"]);
    }
  }

  function toggleEvent(eventId: string) {
    if (eventId === "*") {
      setSelectedEvents(["*"]);
      return;
    }

    const withoutAll = selectedEvents.filter((e) => e !== "*");
    if (withoutAll.includes(eventId)) {
      const next = withoutAll.filter((e) => e !== eventId);
      setSelectedEvents(next.length === 0 ? ["*"] : next);
    } else {
      setSelectedEvents([...withoutAll, eventId]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error("Webhook URL is required");
      return;
    }

    try {
      const eventsStr = selectedEvents.includes("*")
        ? "*"
        : selectedEvents.join(",");
      const endpoint = await createWebhook.mutateAsync({
        url: trimmedUrl,
        description: description.trim() || undefined,
        events: eventsStr,
      });
      toast.success("Webhook endpoint registered");
      close(false);
      onCreated?.(endpoint);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to register webhook endpoint",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-5 text-cf-accent" />
              Add Webhook Endpoint
            </DialogTitle>
            <DialogDescription>
              We’ll send signed HTTP POST requests with an HMAC-SHA256 signature
              to this URL.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://api.yourdomain.com/webhooks/homing"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                required
                className="font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-desc">Description (optional)</Label>
              <Input
                id="webhook-desc"
                placeholder="e.g. Production alerts & Slack relay"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Events to subscribe</Label>
              <div className="flex flex-col gap-2 rounded-lg border border-cf-border bg-cf-bg p-3">
                <label className="flex cursor-pointer items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-cf-fg-strong">
                    All Events (*)
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes("*")}
                    onChange={() => toggleEvent("*")}
                    className="accent-cf-accent rounded"
                  />
                </label>
                <div className="my-1 border-t border-cf-border/60" />
                {AVAILABLE_EVENTS.map((ev) => {
                  const isChecked =
                    selectedEvents.includes(ev.id) &&
                    !selectedEvents.includes("*");
                  return (
                    <label
                      key={ev.id}
                      className="flex cursor-pointer items-start justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-mono font-medium text-cf-fg-strong">
                          {ev.label}
                        </div>
                        <div className="text-[11px] text-cf-fg-muted">
                          {ev.description}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        disabled={selectedEvents.includes("*")}
                        checked={selectedEvents.includes("*") || isChecked}
                        onChange={() => toggleEvent(ev.id)}
                        className="accent-cf-accent mt-0.5 rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              type="submit"
              disabled={createWebhook.isPending}
            >
              {createWebhook.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Create Endpoint"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
