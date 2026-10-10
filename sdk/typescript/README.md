# Homing TypeScript SDK

TypeScript client for the [Homing](https://homing.dev) email API. No dependencies; works in Node 18+, Bun, Deno, and edge runtimes.

```bash
npm install homing
```

```ts
import { Homing } from 'homing'

const homing = new Homing('hom_...') // API key from the dashboard

const { id } = await homing.emails.send({
  from: 'Homing <onboarding@homing.dev>',
  to: 'you@example.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
})

const email = await homing.emails.get(id)
console.log(email.status) // queued, sending, sent or failed
```

- `homing.emails.sendBatch([...])` queues up to 100 emails in one request.
- Errors from the API throw `HomingError` with `statusCode` and `message`.
- Use `new Homing(key, { baseUrl: 'http://localhost:8080' })` for a local API.
