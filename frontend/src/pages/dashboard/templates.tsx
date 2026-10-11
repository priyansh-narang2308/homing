import { useState } from "react";
import {
  Code2,
  Edit2,
  Eye,
  FileCode,
  LayoutTemplate,
  Loader2,
  Plus,
  Trash2,
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
import { TemplateEditorDialog } from "@/components/dashboard/template-editor-dialog";
import { TemplatePreviewDialog } from "@/components/dashboard/template-preview-dialog";
import { useDeleteTemplate, useTemplates } from "@/hooks/use-api";
import { formatDateTime, timeAgo } from "@/lib/time";
import type { EmailTemplate } from "@/lib/types";

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function extractVars(text: string): string[] {
  const matches = text.matchAll(VAR_REGEX);
  const set = new Set<string>();
  for (const m of matches) {
    if (m[1]) set.add(m[1].trim());
  }
  return Array.from(set);
}

const SDK_EXAMPLE = `// Send templated email in Go using the Homing SDK
client := homing.New(os.Getenv("HOMING_API_KEY"))

ids, err := client.Send(ctx, homing.EmailInput{
    To:           "customer@example.com",
    TemplateSlug: "welcome-email",
    Variables: map[string]any{
        "name":      "Alex",
        "login_url": "https://myapp.com/login",
    },
})`;

export function TemplatesPage() {
  const { data: templates, isPending, isError, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [toDelete, setToDelete] = useState<EmailTemplate | null>(null);

  function openCreate() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function openEdit(tmpl: EmailTemplate) {
    setEditingTemplate(tmpl);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteTemplate.mutateAsync(toDelete.id);
      toast.success(`Deleted template "${toDelete.name}"`);
      setToDelete(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete template",
      );
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-medium tracking-[-0.72px] text-cf-fg-strong">
            Email Templates
          </h1>
          <p className="mt-1 text-sm text-cf-fg-muted">
            Design reusable dynamic email templates with variable substitution
            and live inbox preview.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-9 cursor-pointer rounded-full px-4"
        >
          <Plus /> New template
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-cf-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-cf-bg-raised hover:bg-cf-bg-raised">
              <TableHead className="pl-4">Template</TableHead>
              <TableHead>API Slug</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-36 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8">
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}

            {!isPending && (templates?.length ?? 0) === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-16 text-center text-sm text-cf-fg-muted"
                >
                  {isError ? (
                    error.message
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <LayoutTemplate className="size-8 text-cf-fg-muted/60" />
                      <div>
                        No templates found. Create one or load a starter preset
                        to get started.
                      </div>
                      <Button
                        onClick={openCreate}
                        size="sm"
                        className="mt-2 rounded-full cursor-pointer"
                      >
                        Create First Template
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}

            {templates?.map((tmpl) => {
              const vars = extractVars(tmpl.subject + " " + tmpl.html_content);

              return (
                <TableRow key={tmpl.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-cf-border bg-cf-bg-raised">
                        <FileCode className="size-4 text-cf-accent" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-xs text-cf-fg-strong truncate max-w-[200px]">
                          {tmpl.name}
                        </span>
                        {tmpl.description && (
                          <span className="text-[11px] text-cf-fg-muted truncate max-w-[200px]">
                            {tmpl.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 font-mono text-xs text-cf-fg">
                      <span className="rounded bg-cf-bg px-1.5 py-0.5 border border-cf-border font-medium">
                        {tmpl.slug}
                      </span>
                      <CopyButton value={tmpl.slug} label="Copy slug" />
                    </div>
                  </TableCell>

                  <TableCell className="font-sans text-xs text-cf-fg-strong max-w-[220px] truncate">
                    {tmpl.subject}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {vars.length === 0 ? (
                        <span className="text-[11px] text-cf-fg-muted">
                          None
                        </span>
                      ) : (
                        vars.slice(0, 3).map((v) => (
                          <Badge
                            key={v}
                            variant="outline"
                            className="text-[10px] font-mono px-1.5 py-0 text-cf-fg-muted"
                          >
                            {`{{${v}}}`}
                          </Badge>
                        ))
                      )}
                      {vars.length > 3 && (
                        <span className="text-[10px] text-cf-fg-muted self-center">
                          +{vars.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell
                    className="text-cf-fg-muted text-xs"
                    title={formatDateTime(tmpl.created_at)}
                  >
                    {timeAgo(tmpl.created_at)}
                  </TableCell>

                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs text-cf-fg-muted hover:text-cf-fg-strong"
                        onClick={() => setPreviewTemplate(tmpl)}
                      >
                        <Eye className="size-3.5" />
                        Preview
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit template"
                        onClick={() => openEdit(tmpl)}
                        className="size-8 text-cf-fg-muted hover:text-cf-fg-strong"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete template"
                        onClick={() => setToDelete(tmpl)}
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

      {/* SDK Documentation */}
      <div className="rounded-xl border border-cf-border bg-cf-bg-raised p-6">
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-cf-accent" />
          <h3 className="text-sm font-semibold text-cf-fg-strong">
            Sending by Template Slug
          </h3>
        </div>
        <p className="mt-1 text-xs text-cf-fg-muted">
          Pass your template's slug and key-value variables to the API or SDK.
          Placeholders like{" "}
          <code className="font-mono text-cf-fg">{"{{name}}"}</code> are
          automatically rendered on our distributed queue workers before
          dispatch.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-cf-border bg-cf-bg">
          <CodeBlock code={SDK_EXAMPLE} />
        </div>
      </div>

      {/* Dialogs */}
      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
      />

      <TemplatePreviewDialog
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        template={previewTemplate}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete email template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <code className="font-mono text-xs">{toDelete?.name}</code> (
              {toDelete?.slug})? Any API calls referencing this slug will fail
              unless updated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteTemplate.isPending}
              onClick={confirmDelete}
            >
              {deleteTemplate.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Delete Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
