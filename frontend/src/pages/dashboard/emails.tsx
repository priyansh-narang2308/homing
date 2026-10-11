import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Loader2,
  Mail,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useEmailEvents, useEmails, useRetryEmail } from "@/hooks/use-api";
import { formatDateTime, timeAgo } from "@/lib/time";
import type {
  Email,
  EmailEvent,
  EmailEventType,
  EmailStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const statuses: { value: EmailStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Queued" },
  { value: "sending", label: "Sending" },
  { value: "failed", label: "Failed" },
  { value: "dlq", label: "Dead Letter (DLQ)" },
];

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2 text-sm">
      <span className="text-cf-fg-muted">{label}</span>
      <span className="min-w-0 wrap-break-word text-cf-fg-strong">
        {children}
      </span>
    </div>
  );
}

function eventMeta(type: EmailEventType) {
  switch (type) {
    case "queued":
      return {
        icon: Clock,
        label: "Queued in Stream",
        textColor: "text-cf-fg-muted",
        border: "border-cf-border",
        bg: "bg-cf-bg",
      };
    case "claimed":
      return {
        icon: Cpu,
        label: "Claimed by Worker",
        textColor: "text-cyan-400",
        border: "border-cyan-400/30",
        bg: "bg-cyan-400/10",
      };
    case "sent":
      return {
        icon: CheckCircle2,
        label: "Delivered (250 OK)",
        textColor: "text-emerald-400",
        border: "border-emerald-400/30",
        bg: "bg-emerald-400/10",
      };
    case "retry_scheduled":
      return {
        icon: RotateCcw,
        label: "Retry Scheduled",
        textColor: "text-amber-400",
        border: "border-amber-400/30",
        bg: "bg-amber-400/10",
      };
    case "dlq_moved":
      return {
        icon: AlertTriangle,
        label: "Moved to DLQ",
        textColor: "text-orange-400",
        border: "border-orange-400/30",
        bg: "bg-orange-400/10",
      };
    case "replayed":
      return {
        icon: Sparkles,
        label: "Replayed from DLQ",
        textColor: "text-blue-400",
        border: "border-blue-400/30",
        bg: "bg-blue-400/10",
      };
    case "failed":
      return {
        icon: AlertTriangle,
        label: "Failed",
        textColor: "text-red-400",
        border: "border-red-400/30",
        bg: "bg-red-400/10",
      };
    default:
      return {
        icon: Clock,
        label: type,
        textColor: "text-cf-fg-muted",
        border: "border-cf-border",
        bg: "bg-cf-bg",
      };
  }
}

function EmailTimeline({
  events,
  isLoading,
}: {
  events?: EmailEvent[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="py-4 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <p className="py-4 text-xs text-cf-fg-muted italic">
        No lifecycle events recorded for this email.
      </p>
    );
  }

  return (
    <div className="relative mt-3 space-y-3 border-l border-dashed border-cf-border/80 pl-4 ml-2">
      {events.map((ev) => {
        const meta = eventMeta(ev.event_type);
        const Icon = meta.icon;

        return (
          <div key={ev.id} className="relative group">
            {/* Dot marker */}
            <span
              className={cn(
                "absolute -left-[23px] top-1 flex size-3.5 items-center justify-center rounded-full border bg-cf-bg-raised",
                meta.border,
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  meta.textColor.replace("text-", "bg-"),
                )}
              />
            </span>

            <div className="rounded-lg border border-cf-border/60 bg-cf-bg/70 p-2.5 text-xs transition hover:border-cf-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("size-3.5", meta.textColor)} />
                  <span className={cn("font-medium", meta.textColor)}>
                    {meta.label}
                  </span>
                  {ev.attempt > 0 && (
                    <span className="text-[10px] text-cf-fg-muted/70 font-mono">
                      (attempt #{ev.attempt})
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-cf-fg-muted">
                  {formatDateTime(ev.created_at)}
                </span>
              </div>

              {ev.details && (
                <p className="mt-1 text-cf-fg/90 font-mono text-[11px] leading-relaxed break-words">
                  {ev.details}
                </p>
              )}

              {ev.worker_id && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-cf-fg-muted/60 font-mono">
                  <span>worker:</span>
                  <span className="truncate">{ev.worker_id}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmailsPage() {
  const [status, setStatus] = useState<EmailStatus | "all">("all");
  const [selected, setSelected] = useState<Email | null>(null);
  const query = useEmails(status === "all" ? undefined : status);
  const emails = query.data?.pages.flatMap((p) => p.data) ?? [];

  const eventsQuery = useEmailEvents(selected?.id ?? null);
  const retryMutation = useRetryEmail();

  async function handleRetry(emailId: string) {
    try {
      await retryMutation.mutateAsync(emailId);
      toast.success("Email replayed", {
        description:
          "Re-enqueued into Redis Stream for immediate worker pickup.",
      });
      if (selected) {
        setSelected({ ...selected, status: "queued", last_error: undefined });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry email");
    }
  }

  return (
    <>
      <h1 className="text-[28px] font-medium tracking-[-0.72px] text-cf-fg-strong">
        Emails
      </h1>

      <div className="mt-8 flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 min-w-44 justify-between cursor-pointer"
            >
              {statuses.find((s) => s.value === status)?.label}
              <ChevronDown className="text-cf-fg-muted" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as EmailStatus | "all")}
            >
              {statuses.map((s) => (
                <DropdownMenuRadioItem
                  className="cursor-pointer"
                  key={s.value}
                  value={s.value}
                >
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {query.isFetching && !query.isPending && (
          <Loader2 className="size-4 animate-spin text-cf-fg-muted" />
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-cf-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-cf-bg-raised hover:bg-cf-bg-raised">
              <TableHead className="pl-4">To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="pr-4 text-right">Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="px-4">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!query.isPending && emails.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="py-16 text-center text-sm text-cf-fg-muted"
                >
                  {query.isError
                    ? query.error.message
                    : "No emails found for this filter."}
                </TableCell>
              </TableRow>
            )}

            {emails.map((email) => (
              <TableRow
                key={email.id}
                className="cursor-pointer"
                onClick={() => setSelected(email)}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg border border-cf-border bg-cf-bg-raised">
                      <Mail className="size-4 text-cf-fg-muted" />
                    </span>
                    <span className="truncate text-cf-fg-strong">
                      {email.to}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={email.status} />
                </TableCell>
                <TableCell className="max-w-72 truncate text-cf-fg">
                  {email.subject || "(no subject)"}
                </TableCell>
                <TableCell
                  className="pr-4 text-right text-cf-fg-muted"
                  title={formatDateTime(email.sent_at ?? email.created_at)}
                >
                  {timeAgo(email.sent_at ?? email.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {query.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage && <Loader2 className="animate-spin" />}
            Load more
          </Button>
        </div>
      )}

      {/* Delivery Intelligence Modal */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="bg-cf-bg-raised sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div>
                    <DialogTitle className="text-lg font-medium text-cf-fg-strong">
                      {selected.subject || "(no subject)"}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs mt-1 text-cf-fg-muted">
                      ID: {selected.id}
                    </DialogDescription>
                  </div>
                  {(selected.status === "failed" ||
                    selected.status === "dlq") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(selected.id)}
                      disabled={retryMutation.isPending}
                      className="gap-1.5 border-orange-500/40 text-orange-300 hover:bg-orange-500/10 active:scale-95"
                    >
                      {retryMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      <span>Replay DLQ</span>
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="divide-y divide-cf-border/60">
                <Detail label="Status">
                  <StatusBadge status={selected.status} />
                </Detail>
                <Detail label="Recipient">{selected.to}</Detail>
                <Detail label="Sender">{selected.from}</Detail>
                <Detail label="Total Attempts">{selected.attempts}</Detail>
                {selected.idempotency_key && (
                  <Detail label="Idempotency Key">
                    <span className="font-mono text-xs text-cf-accent">
                      {selected.idempotency_key}
                    </span>
                  </Detail>
                )}
                <Detail label="Created">
                  {formatDateTime(selected.created_at)}
                </Detail>
                {selected.sent_at && (
                  <Detail label="Delivered at">
                    {formatDateTime(selected.sent_at)}
                  </Detail>
                )}
                {selected.last_error && (
                  <Detail label="Diagnostic error">
                    <span className="font-mono text-xs text-red-300">
                      {selected.last_error}
                    </span>
                  </Detail>
                )}
              </div>

              {/* Delivery Intelligence Console / Timeline */}
              <div className="mt-5 border-t border-cf-border/80 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-cf-fg-muted">
                    Delivery Intelligence Timeline
                  </h4>
                  {eventsQuery.isFetching && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-cf-fg-muted">
                      <Loader2 className="size-3 animate-spin" /> Live sync
                    </span>
                  )}
                </div>

                <EmailTimeline
                  events={eventsQuery.data ?? selected.events}
                  isLoading={eventsQuery.isLoading}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
