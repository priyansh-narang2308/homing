import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiKey, CreatedApiKey, Email, EmailStatus, Page, Usage, WebhookDelivery, WebhookEndpoint } from '@/lib/types'

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api<{ data: ApiKey[] }>('/dashboard/api-keys').then((r) => r.data),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<CreatedApiKey>('/dashboard/api-keys', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/dashboard/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useEmails(status?: EmailStatus) {
  return useInfiniteQuery({
    queryKey: ['emails', status ?? 'all'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' })
      if (status) params.set('status', status)
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<Email>>(`/dashboard/emails?${params}`)
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    // Queued emails change status within seconds, so keep the list fresh while it's open.
    refetchInterval: 5_000,
  })
}

export function useUsage() {
  return useQuery({
    queryKey: ['usage'],
    queryFn: () => api<Usage>('/dashboard/usage'),
    // Emails sent through the API or SDK also count, so poll to pick those up.
    refetchInterval: 10_000,
  })
}

export function useSendTestEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ data: { id: string }[] }>('/dashboard/test-email', { method: 'POST' }),
    // Refresh usage on failure too: a 429 means the count is already at the limit.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['usage'] })
    },
  })
}

export function useEmailEvents(emailId: string | null) {
  return useQuery({
    queryKey: ['email-events', emailId],
    queryFn: () =>
      api<{ data: import('@/lib/types').EmailEvent[] }>(`/dashboard/emails/${emailId}/events`).then(
        (r) => r.data,
      ),
    enabled: Boolean(emailId),
    refetchInterval: (query) => {
      // If events show it's still queued or sending, poll every 2s
      const events = query.state.data
      const last = events?.[events.length - 1]
      if (last && (last.event_type === 'queued' || last.event_type === 'claimed' || last.event_type === 'retry_scheduled')) {
        return 2_000
      }
      return false
    },
  })
}

export function useRetryEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ data: { id: string; status: string } }>(`/dashboard/emails/${id}/retry`, {
        method: 'POST',
      }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['email-events', id] })
    },
  })
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api<{ data: WebhookEndpoint[] }>('/dashboard/webhooks').then((r) => r.data),
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { url: string; description?: string; events?: string }) =>
      api<WebhookEndpoint>('/dashboard/webhooks', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/dashboard/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useTestWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ data: WebhookDelivery }>(`/dashboard/webhooks/${id}/test`, { method: 'POST' }).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] })
    },
  })
}

export function useWebhookDeliveries(endpointId: string | null) {
  return useQuery({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn: () =>
      api<{ data: WebhookDelivery[] }>(`/dashboard/webhooks/${endpointId}/deliveries`).then((r) => r.data),
    enabled: Boolean(endpointId),
    refetchInterval: 5_000,
  })
}

export function useReplayWebhookDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deliveryId: string) =>
      api<{ data: WebhookDelivery }>(`/dashboard/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST' }).then(
        (r) => r.data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhook-deliveries'] })
    },
  })
}

