import { useEffect, useState } from 'react'
import {
  Code,
  Eye,
  Laptop,
  Loader2,
  Mail,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/use-session'
import { useTestSendTemplate } from '@/hooks/use-api'
import type { EmailTemplate } from '@/lib/types'

// Regex to find all unique {{key}} or {{ key }}
const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

function extractVars(text: string): string[] {
  const matches = text.matchAll(VAR_REGEX)
  const set = new Set<string>()
  for (const m of matches) {
    if (m[1]) set.add(m[1].trim())
  }
  return Array.from(set)
}

function renderText(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(VAR_REGEX, (_, key) => {
    return vars[key.trim()] ?? ''
  })
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate | null
}) {
  const { data: session } = useSession()
  const testSend = useTestSendTemplate()

  const [vars, setVars] = useState<Record<string, string>>({})
  const [recipient, setRecipient] = useState('')
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview')

  useEffect(() => {
    if (template) {
      let initialVars: Record<string, string> = {}
      try {
        const parsed = JSON.parse(template.sample_vars)
        for (const [k, v] of Object.entries(parsed)) {
          initialVars[k] = String(v)
        }
      } catch {
        // fallback
      }

      // Ensure all detected variables have at least an empty string or sample value
      const detected = extractVars(template.subject + ' ' + template.html_content)
      for (const d of detected) {
        if (initialVars[d] === undefined) {
          initialVars[d] = ''
        }
      }

      setVars(initialVars)
    }
    if (session?.user?.email) {
      setRecipient(session.user.email)
    }
  }, [template, session, open])

  if (!template) return null

  const detectedVars = extractVars(template.subject + ' ' + template.html_content)
  const renderedSubject = renderText(template.subject, vars)
  const renderedHTML = renderText(template.html_content, vars)

  function updateVar(key: string, value: string) {
    setVars((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSendTest() {
    if (!template) return
    if (!recipient.trim()) {
      return toast.error('Recipient email address is required')
    }

    try {
      await testSend.mutateAsync({
        id: template.id,
        to: recipient.trim(),
        variables: vars,
      })
      toast.success(`Test email enqueued and sent to ${recipient}!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test email')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-5xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-cf-accent" />
              <DialogTitle>{template.name}</DialogTitle>
              <Badge variant="outline" className="font-mono text-[11px] text-cf-fg-muted">
                {template.slug}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-cf-border bg-cf-bg p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={`size-7 ${viewport === 'desktop' ? 'bg-cf-bg-raised text-cf-fg-strong' : 'text-cf-fg-muted'}`}
                  onClick={() => setViewport('desktop')}
                  title="Desktop View"
                >
                  <Laptop className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={`size-7 ${viewport === 'mobile' ? 'bg-cf-bg-raised text-cf-fg-strong' : 'text-cf-fg-muted'}`}
                  onClick={() => setViewport('mobile')}
                  title="Mobile View"
                >
                  <Smartphone className="size-3.5" />
                </Button>
              </div>

              <div className="flex rounded-md border border-cf-border bg-cf-bg p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={`size-7 ${viewMode === 'preview' ? 'bg-cf-bg-raised text-cf-fg-strong' : 'text-cf-fg-muted'}`}
                  onClick={() => setViewMode('preview')}
                  title="Visual Preview"
                >
                  <Eye className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={`size-7 ${viewMode === 'html' ? 'bg-cf-bg-raised text-cf-fg-strong' : 'text-cf-fg-muted'}`}
                  onClick={() => setViewMode('html')}
                  title="Rendered HTML Source"
                >
                  <Code className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <DialogDescription className="text-xs">
            Test and interact with your template variables live before sending to customers.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 flex-1 overflow-hidden">
          {/* Left Column: Variable Tweaking & Test Send Form */}
          <div className="lg:col-span-4 flex flex-col gap-5 overflow-y-auto pr-1">
            <div className="flex flex-col gap-3 rounded-xl border border-cf-border bg-cf-bg p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cf-fg-strong">
                <Sparkles className="size-3.5 text-cf-accent" />
                Interactive Variables ({detectedVars.length})
              </div>
              {detectedVars.length === 0 ? (
                <p className="text-xs text-cf-fg-muted">No {'{{variables}}'} detected in this template.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {detectedVars.map((v) => (
                    <div key={v} className="flex flex-col gap-1.5">
                      <Label htmlFor={`var-${v}`} className="font-mono text-xs text-cf-fg-muted">
                        {`{{${v}}}`}
                      </Label>
                      <Input
                        id={`var-${v}`}
                        value={vars[v] ?? ''}
                        onChange={(e) => updateVar(v, e.target.value)}
                        placeholder={`Value for ${v}`}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-cf-border bg-cf-bg p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cf-fg-strong">
                <Send className="size-3.5 text-cf-accent" />
                Send Real Test Email
              </div>
              <p className="text-[11px] text-cf-fg-muted">
                Deliver this rendered template directly to an inbox to verify visual fidelity.
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <Button
                  size="sm"
                  className="h-8 w-full gap-1.5 text-xs"
                  onClick={handleSendTest}
                  disabled={testSend.isPending}
                >
                  {testSend.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Send Test Email
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Rendered Canvas Frame */}
          <div className="lg:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* Subject Preview Header */}
            <div className="flex items-center gap-3 rounded-lg border border-cf-border bg-cf-bg px-4 py-2.5">
              <span className="text-xs font-medium text-cf-fg-muted shrink-0">Subject:</span>
              <span className="text-xs font-semibold text-cf-fg-strong truncate font-sans">
                {renderedSubject || <span className="text-cf-fg-muted italic">No subject provided</span>}
              </span>
            </div>

            {/* Canvas Viewport */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-cf-border bg-[#0d0c0c] p-4 flex justify-center">
              {viewMode === 'preview' ? (
                <div
                  className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-200 ${
                    viewport === 'mobile' ? 'w-[360px]' : 'w-full max-w-[620px]'
                  }`}
                  style={{ minHeight: '380px' }}
                >
                  <iframe
                    title="Rendered Email Preview"
                    srcDoc={renderedHTML}
                    className="w-full h-full min-h-[420px] border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="w-full">
                  <pre className="max-h-[420px] overflow-x-auto rounded-lg border border-cf-border bg-cf-bg p-4 font-mono text-xs text-cf-fg-muted leading-relaxed">
                    {renderedHTML}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
