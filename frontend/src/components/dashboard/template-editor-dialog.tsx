import { useEffect, useState } from 'react'
import { FileCode, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-api'
import type { EmailTemplate } from '@/lib/types'

const PRESETS = [
  {
    name: 'Welcome Email',
    slug: 'welcome-email',
    description: 'Onboarding welcome email for newly registered accounts',
    subject: 'Welcome to Homing, {{name}}! 🚀',
    sampleVars: { name: 'Alex', login_url: 'https://app.homing.dev/dashboard' },
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #151414; border-radius: 12px; border: 1px solid #e5e5e5;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: 700; font-size: 20px; color: #ff5e1f; letter-spacing: -0.5px;">homing</span>
  </div>
  <h1 style="font-size: 22px; font-weight: 600; line-height: 1.3; margin: 0 0 16px; color: #151414;">Welcome aboard, {{name}}!</h1>
  <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 20px;">
    We're excited to have you on board. Your transactional email infrastructure is now ready to send high-throughput notifications with zero deliverability headaches.
  </p>
  <div style="margin: 28px 0;">
    <a href="{{login_url}}" style="background-color: #ff5e1f; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
      Go to your Dashboard →
    </a>
  </div>
  <p style="font-size: 13px; color: #9ca3af; margin: 24px 0 0; border-top: 1px solid #f3f4f6; padding-top: 16px;">
    If you did not sign up for this account, you can safely ignore this email.
  </p>
</div>`,
  },
  {
    name: 'Password Reset',
    slug: 'password-reset',
    description: 'Secure password reset link with expiration notice',
    subject: 'Reset your password for {{app_name}}',
    sampleVars: { app_name: 'Homing', reset_link: 'https://app.homing.dev/reset?token=xyz987', expires_in: '30 minutes' },
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #151414; border-radius: 12px; border: 1px solid #e5e5e5;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: 700; font-size: 20px; color: #ff5e1f;">homing</span>
  </div>
  <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px; color: #151414;">Password Reset Request</h1>
  <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 20px;">
    We received a request to reset your password for <strong>{{app_name}}</strong>. Click the button below to choose a new password. This link will expire in {{expires_in}}.
  </p>
  <div style="margin: 24px 0;">
    <a href="{{reset_link}}" style="background-color: #151414; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
      Reset Password
    </a>
  </div>
  <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; border-top: 1px solid #f3f4f6; padding-top: 16px;">
    If you didn't request a password reset, no action is needed. Your account remains secure.
  </p>
</div>`,
  },
  {
    name: 'Order Confirmation',
    slug: 'order-confirmation',
    description: 'Transactional purchase receipt with order details',
    subject: 'Order #{{order_id}} confirmed! 📦',
    sampleVars: { customer_name: 'Jordan', order_id: 'HM-84920', total_amount: '$149.00', tracking_url: 'https://track.homing.dev/HM-84920' },
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #151414; border-radius: 12px; border: 1px solid #e5e5e5;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: 700; font-size: 20px; color: #ff5e1f;">homing</span>
  </div>
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 12px; color: #151414;">Thank you for your order, {{customer_name}}!</h1>
  <p style="font-size: 14px; color: #4b5563; margin: 0 0 20px;">
    Your order <strong>#{{order_id}}</strong> has been received and is being prepared.
  </p>
  <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Total Charged:</div>
    <div style="font-size: 20px; font-weight: 700; color: #151414;">{{total_amount}}</div>
  </div>
  <div style="margin: 24px 0;">
    <a href="{{tracking_url}}" style="background-color: #ff5e1f; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
      Track Shipment
    </a>
  </div>
</div>`,
  },
]

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate | null
  onSaved?: (tmpl: EmailTemplate) => void
}) {
  const isEditing = Boolean(template)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [sampleVarsJson, setSampleVarsJson] = useState('{\n  "name": "Alex"\n}')

  useEffect(() => {
    if (template) {
      setName(template.name)
      setSlug(template.slug)
      setDescription(template.description || '')
      setSubject(template.subject)
      setHtmlContent(template.html_content)
      try {
        setSampleVarsJson(JSON.stringify(JSON.parse(template.sample_vars), null, 2))
      } catch {
        setSampleVarsJson(template.sample_vars || '{}')
      }
    } else {
      setName('')
      setSlug('')
      setDescription('')
      setSubject('')
      setHtmlContent('')
      setSampleVarsJson('{\n  "name": "Alex"\n}')
    }
  }, [template, open])

  function handleNameChange(val: string) {
    setName(val)
    if (!isEditing && (!slug || slug === slugify(name))) {
      setSlug(slugify(val))
    }
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    setName(preset.name)
    setSlug(preset.slug)
    setDescription(preset.description)
    setSubject(preset.subject)
    setHtmlContent(preset.html)
    setSampleVarsJson(JSON.stringify(preset.sampleVars, null, 2))
    toast.success(`Loaded "${preset.name}" preset template`)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Template name is required')
    if (!slug.trim()) return toast.error('Template slug is required')
    if (!subject.trim()) return toast.error('Email subject is required')
    if (!htmlContent.trim()) return toast.error('HTML content is required')

    let parsedVars: Record<string, unknown> = {}
    if (sampleVarsJson.trim()) {
      try {
        parsedVars = JSON.parse(sampleVarsJson)
      } catch (err) {
        return toast.error('Sample variables must be valid JSON: ' + (err instanceof Error ? err.message : 'Invalid JSON'))
      }
    }

    try {
      if (isEditing && template) {
        const res = await updateTemplate.mutateAsync({
          id: template.id,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          subject: subject.trim(),
          html_content: htmlContent.trim(),
          sample_vars: parsedVars,
        })
        toast.success('Template updated successfully')
        onOpenChange(false)
        onSaved?.(res)
      } else {
        const res = await createTemplate.mutateAsync({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          subject: subject.trim(),
          html_content: htmlContent.trim(),
          sample_vars: parsedVars,
        })
        toast.success('Template created successfully')
        onOpenChange(false)
        onSaved?.(res)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template')
    }
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-cf-border bg-cf-bg-raised sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="size-5 text-cf-accent" />
              {isEditing ? 'Edit Email Template' : 'Create Email Template'}
            </DialogTitle>
            <DialogDescription>
              Use <code className="font-mono text-cf-fg">{'{{variable}}'}</code> tags in the subject and HTML body for dynamic rendering.
            </DialogDescription>
          </DialogHeader>

          {!isEditing && (
            <div className="flex flex-col gap-2 rounded-lg border border-cf-border bg-cf-bg p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-cf-fg-strong">
                  <Wand2 className="size-3.5 text-cf-accent" /> Starter Presets:
                </span>
                <span className="text-[11px] text-cf-fg-muted">Click to populate layout</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESETS.map((p) => (
                  <Button
                    key={p.slug}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-cf-bg-raised hover:bg-cf-accent/10 hover:border-cf-accent/40"
                    onClick={() => applyPreset(p)}
                  >
                    <Sparkles className="size-3 text-cf-accent mr-1" />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tmpl-name">Template Name</Label>
              <Input
                id="tmpl-name"
                placeholder="Welcome Email"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tmpl-slug">API Slug</Label>
              <Input
                id="tmpl-slug"
                placeholder="welcome-email"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tmpl-desc">Description (optional)</Label>
            <Input
              id="tmpl-desc"
              placeholder="e.g. Sent upon successful user onboarding"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tmpl-subject">Subject Line</Label>
              <span className="text-[11px] font-mono text-cf-fg-muted">Supports {'{{variables}}'}</span>
            </div>
            <Input
              id="tmpl-subject"
              placeholder="Welcome to Homing, {{name}}!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tmpl-html">HTML Content</Label>
              <span className="text-[11px] font-mono text-cf-fg-muted">Inline styled HTML recommended</span>
            </div>
            <textarea
              id="tmpl-html"
              rows={9}
              className="w-full rounded-md border border-cf-border bg-cf-bg px-3 py-2 font-mono text-xs text-cf-fg-strong placeholder:text-cf-fg-muted/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="<div><h1>Hello, {{name}}!</h1></div>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tmpl-vars">Sample Preview Variables (JSON)</Label>
              <span className="text-[11px] font-mono text-cf-fg-muted">Used for test sending and preview</span>
            </div>
            <textarea
              id="tmpl-vars"
              rows={4}
              className="w-full rounded-md border border-cf-border bg-cf-bg px-3 py-2 font-mono text-xs text-cf-fg-strong placeholder:text-cf-fg-muted/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              value={sampleVarsJson}
              onChange={(e) => setSampleVarsJson(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
