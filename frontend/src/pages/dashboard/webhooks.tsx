import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CodeBlock } from "@/components/dashboard/code-block";
import { CopyButton } from "@/components/dashboard/copy-button";
import { CreateWebhookDialog } from "@/components/dashboard/create-webhook-dialog";
import {
  useDeleteWebhook,
  useReplayWebhookDelivery,
  useTestWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from "@/hooks/use-api";
import { formatDateTime, timeAgo } from "@/lib/time";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/types";

const VERIFY_EXAMPLE = `// Verify Homing-Signature in Node.js
import crypto from 'node:crypto';

export function verifyHomingWebhook(rawBody, signatureHeader, secret) {
  // signatureHeader format: "t=1728640000,v1=abcdef0123..."
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(kv => kv.split('='))
  );
  const timestamp = parts.t;
  const signature = parts.v1;

  const signedPayload = \`\${timestamp}.\${rawBody}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}`;

export function WebhooksPage() {
  const { data: endpoints, isPending, isError, error } = useWebhooks();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();
  const replayDelivery = useReplayWebhookDelivery();

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<WebhookEndpoint | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    null,
  );
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, boolean>
  >({});
  const [inspectDelivery, setInspectDelivery] =
    useState<WebhookDelivery | null>(null);
  const [testingEndpointId, setTestingEndpointId] = useState<string | null>(
    null,
  );
  const [replayingDeliveryId, setReplayingDeliveryId] = useState<string | null>(
    null,
  );

  // Default selected endpoint to the first one available
  const activeEndpoint =
    endpoints?.find((e) => e.id === selectedEndpointId) ??
    (endpoints && endpoints.length > 0 ? endpoints[0] : null);
  const activeEndpointId = activeEndpoint ? activeEndpoint.id : null;

  const { data: deliveries, isPending: isDeliveriesPending } =
    useWebhookDeliveries(activeEndpointId);

  function toggleSecret(id: string) {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteWebhook.mutateAsync(toDelete.id);
      toast.success("Webhook endpoint removed");
      if (selectedEndpointId === toDelete.id) {
        setSelectedEndpointId(null);
      }
      setToDelete(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete webhook",
      );
    }
  }

  async function handleTestPing(endpoint: WebhookEndpoint) {
    setTestingEndpointId(endpoint.id);
    try {
      const res = await testWebhook.mutateAsync(endpoint.id);
      if (res.status === "delivered") {
        toast.success(
          `Ping delivered (HTTP ${res.response_code} in ${res.latency_ms}ms)`,
        );
      } else {
        toast.error(
          `Ping failed (HTTP ${res.response_code || "error"}: ${res.error || "Connection error"})`,
        );
      }
      setSelectedEndpointId(endpoint.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to dispatch ping",
      );
    } finally {
      setTestingEndpointId(null);
    }
  }

  async function handleReplay(delivery: WebhookDelivery) {
    setReplayingDeliveryId(delivery.id);
    try {
      const res = await replayDelivery.mutateAsync(delivery.id);
      if (res.status === "delivered") {
        toast.success(
          `Event replayed successfully (HTTP ${res.response_code} in ${res.latency_ms}ms)`,
        );
      } else {
        toast.error(
          `Replay returned error (HTTP ${res.response_code}): ${res.error || "Failed"}`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to replay webhook event",
      );
    } finally {
      setReplayingDeliveryId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-medium tracking-[-0.72px] text-cf-fg-strong">
            Webhooks
          </h1>
          <p className="mt-1 text-sm text-cf-fg-muted">
            Receive signed HTTP POST notifications with HMAC-SHA256 signatures
            for email events.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 rounded-full px-4 cursor-pointer"
        >
          <Plus /> Add endpoint
        </Button>
      </div>

      {/* Endpoints Table */}
      <div className="overflow-hidden rounded-xl border border-cf-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-cf-bg-raised hover:bg-cf-bg-raised">
              <TableHead className="pl-4">Endpoint</TableHead>
              <TableHead>Subscribed Events</TableHead>
              <TableHead>Signing Secret</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-36 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-8">
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}

            {!isPending && (endpoints?.length ?? 0) === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-16 text-center text-sm text-cf-fg-muted"
                >
                  {isError
                    ? error.message
                    : "No webhook endpoints registered yet. Add one to receive real-time events."}
                </TableCell>
              </TableRow>
            )}

            {endpoints?.map((ep) => {
              const isSelected = ep.id === activeEndpointId;
              const isSecretVisible = revealedSecrets[ep.id];
              const isPinging = testingEndpointId === ep.id;

              return (
                <TableRow
                  key={ep.id}
                  className={isSelected ? "bg-cf-bg-raised/70" : undefined}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-cf-border bg-cf-bg-raised">
                        <Globe className="size-4 text-cf-accent" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-cf-fg-strong truncate max-w-70">
                            {ep.url}
                          </span>
                          <span
                            className="inline-block size-1.5 rounded-full bg-emerald-500"
                            title="Active"
                          />
                        </div>
                        {ep.description && (
                          <span className="text-[11px] text-cf-fg-muted truncate max-w-70">
                            {ep.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ep.events === "*" ? (
                        <Badge
                          variant="outline"
                          className="border-cf-accent/30 bg-cf-accent/10 text-[11px] text-cf-accent font-mono"
                        >
                          * (All Events)
                        </Badge>
                      ) : (
                        ep.events.split(",").map((ev) => (
                          <Badge
                            key={ev}
                            variant="outline"
                            className="text-[11px] font-mono text-cf-fg-muted"
                          >
                            {ev}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-cf-fg">
                      <span>
                        {isSecretVisible
                          ? ep.secret
                          : `${ep.secret.slice(0, 10)}••••••••••••`}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggleSecret(ep.id)}
                        aria-label={
                          isSecretVisible ? "Hide secret" : "Reveal secret"
                        }
                        className="size-6 text-cf-fg-muted hover:text-cf-fg-strong"
                      >
                        {isSecretVisible ? (
                          <EyeOff className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                      </Button>
                      <CopyButton
                        value={ep.secret}
                        label="Copy signing secret"
                      />
                    </div>
                  </TableCell>

                  <TableCell
                    className="text-cf-fg-muted text-xs"
                    title={formatDateTime(ep.created_at)}
                  >
                    {timeAgo(ep.created_at)}
                  </TableCell>

                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 text-xs text-cf-fg-muted hover:text-cf-fg-strong"
                        onClick={() => handleTestPing(ep)}
                        disabled={isPinging}
                      >
                        {isPinging ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        Ping
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 gap-1.5 px-2.5 text-xs ${
                          isSelected
                            ? "bg-cf-accent/15 text-cf-accent font-medium"
                            : "text-cf-fg-muted hover:text-cf-fg-strong"
                        }`}
                        onClick={() => setSelectedEndpointId(ep.id)}
                      >
                        <Activity className="size-3.5" />
                        Logs
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete endpoint"
                        onClick={() => setToDelete(ep)}
                        className="size-8 text-cf-fg-muted hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Deliveries Log Console */}
      {activeEndpoint && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-cf-accent" />
              <h2 className="text-base font-medium text-cf-fg-strong">
                Delivery Logs
              </h2>
              <span className="font-mono text-xs text-cf-fg-muted">
                ({activeEndpoint.url})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-cf-fg-muted">
                Auto-refreshes every 5s
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-cf-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-cf-bg-raised hover:bg-cf-bg-raised">
                  <TableHead className="pl-4">Status</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>HTTP Code</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead className="w-28 pr-4 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDeliveriesPending && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-8">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}

                {!isDeliveriesPending && (deliveries?.length ?? 0) === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-cf-fg-muted"
                    >
                      No events dispatched to this endpoint yet. Click{" "}
                      <strong>Ping</strong> above to test delivery.
                    </TableCell>
                  </TableRow>
                )}

                {deliveries?.map((d) => {
                  const isSuccess =
                    d.status === "delivered" &&
                    d.response_code >= 200 &&
                    d.response_code < 300;
                  const isReplaying = replayingDeliveryId === d.id;

                  return (
                    <TableRow key={d.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-1.5">
                          {isSuccess ? (
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="size-3.5 text-rose-400" />
                          )}
                          <span
                            className={`text-xs font-medium capitalize ${
                              isSuccess ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-cf-fg-strong">
                        <span className="rounded bg-cf-bg px-1.5 py-0.5 border border-cf-border">
                          {d.event_type}
                        </span>
                      </TableCell>

                      <TableCell className="font-mono text-xs">
                        {d.response_code > 0 ? (
                          <span
                            className={
                              d.response_code >= 200 && d.response_code < 300
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {d.response_code}
                          </span>
                        ) : (
                          <span className="text-cf-fg-muted">—</span>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-cf-fg-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-cf-fg-muted/60" />
                          {d.latency_ms}ms
                        </span>
                      </TableCell>

                      <TableCell
                        className="text-xs text-cf-fg-muted"
                        title={formatDateTime(d.created_at)}
                      >
                        {timeAgo(d.created_at)}
                      </TableCell>

                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-cf-fg-muted hover:text-cf-fg-strong"
                            onClick={() => setInspectDelivery(d)}
                          >
                            <Code2 className="size-3 mr-1" />
                            Payload
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-cf-fg-muted hover:text-cf-fg-strong"
                            onClick={() => handleReplay(d)}
                            disabled={isReplaying}
                          >
                            {isReplaying ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="size-3 mr-1" />
                            )}
                            Replay
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Signature Verification Reference */}
      <div className="rounded-xl border border-cf-border bg-cf-bg-raised p-6">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-cf-accent" />
          <h3 className="text-sm font-semibold text-cf-fg-strong">
            Verifying Signatures
          </h3>
        </div>
        <p className="mt-1 text-xs text-cf-fg-muted">
          Every webhook payload is dispatched with a{" "}
          <code className="font-mono text-cf-fg">Homing-Signature</code> header.
          It contains a unix timestamp{" "}
          <code className="font-mono text-cf-fg">t</code> and an HMAC-SHA256 hex
          digest <code className="font-mono text-cf-fg">v1</code> computed over{" "}
          <code className="font-mono text-cf-fg">t + "." + rawBody</code> using
          your endpoint's signing secret.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-cf-border bg-cf-bg">
          <CodeBlock code={VERIFY_EXAMPLE} />
        </div>
      </div>

      {/* Modals */}
      <CreateWebhookDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Delete Confirmation */}
      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete webhook endpoint</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <code className="font-mono text-xs">{toDelete?.url}</code>? Events
              will no longer be dispatched to this destination.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteWebhook.isPending}
              onClick={confirmDelete}
            >
              {deleteWebhook.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Delete Endpoint"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect Delivery Modal */}
      <Dialog
        open={Boolean(inspectDelivery)}
        onOpenChange={(open) => !open && setInspectDelivery(null)}
      >
        <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {inspectDelivery && (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-mono text-sm">
                  <span>Webhook Event:</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {inspectDelivery.event_type}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Dispatched at {formatDateTime(inspectDelivery.created_at)} (
                  {inspectDelivery.latency_ms}ms)
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-cf-fg-strong">
                  <span>Dispatched JSON Payload</span>
                  <CopyButton
                    value={inspectDelivery.payload}
                    label="Copy payload"
                  />
                </div>
                <pre className="max-h-60 overflow-x-auto rounded-lg border border-cf-border bg-cf-bg p-3 font-mono text-xs text-cf-fg-muted">
                  {(() => {
                    try {
                      return JSON.stringify(
                        JSON.parse(inspectDelivery.payload),
                        null,
                        2,
                      );
                    } catch {
                      return inspectDelivery.payload;
                    }
                  })()}
                </pre>
              </div>

              {inspectDelivery.response_body && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-cf-fg-strong">
                    Endpoint Response (HTTP {inspectDelivery.response_code})
                  </div>
                  <pre className="max-h-40 overflow-x-auto rounded-lg border border-cf-border bg-cf-bg p-3 font-mono text-xs text-cf-fg-muted">
                    {inspectDelivery.response_body}
                  </pre>
                </div>
              )}

              {inspectDelivery.error && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-rose-400">
                    Error Details
                  </div>
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-300">
                    {inspectDelivery.error}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInspectDelivery(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const d = inspectDelivery;
                    setInspectDelivery(null);
                    handleReplay(d);
                  }}
                >
                  <RefreshCw className="size-3.5 mr-1" /> Replay this event
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
