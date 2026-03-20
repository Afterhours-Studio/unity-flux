import { createHmac } from 'node:crypto'
import type { ActivityLog, WebhookRegistration } from '../store/types.js'
import type { DataStore } from '../store/data-store.js'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 3000, 9000] // 1s, 3s, 9s

export class WebhookDispatcher {
  private store: DataStore

  constructor(store: DataStore) {
    this.store = store
  }

  async dispatch(activity: ActivityLog): Promise<void> {
    const webhooks = await this.store.listWebhooks(activity.projectId)
    const matching = webhooks.filter(
      (w) => w.active && w.events.includes(activity.type)
    )

    await Promise.allSettled(
      matching.map((webhook) => this.deliver(webhook, activity))
    )
  }

  private async deliver(webhook: WebhookRegistration, activity: ActivityLog): Promise<void> {
    const payload = JSON.stringify({
      event: activity.type,
      projectId: activity.projectId,
      message: activity.message,
      meta: activity.meta ?? {},
      timestamp: activity.createdAt,
    })

    const signature = createHmac('sha256', webhook.secret)
      .update(payload)
      .digest('hex')

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Flux-Signature': `sha256=${signature}`,
            'X-Flux-Event': activity.type,
          },
          body: payload,
          signal: AbortSignal.timeout(10000),
        })

        if (res.ok) return

        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        }
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        }
      }
    }
    console.warn(`Webhook delivery failed after ${MAX_RETRIES + 1} attempts: ${webhook.url}`)
  }
}
