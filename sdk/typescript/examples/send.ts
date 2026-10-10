// Sends one email with the Homing TypeScript SDK and waits until it is sent or fails.
//
//   HOMING_API_KEY=hom_... bun examples/send.ts you@example.com
import { DEFAULT_BASE_URL, Homing } from '../src/index.ts'

const apiKey = process.env.HOMING_API_KEY
if (!apiKey) {
  console.error('set HOMING_API_KEY to a key from the Homing dashboard')
  process.exit(1)
}
const to = process.argv[2] ?? 'delivered@example.com'

const homing = new Homing(apiKey, { baseUrl: process.env.HOMING_BASE_URL ?? DEFAULT_BASE_URL })

const { id } = await homing.emails.send({
  from: 'Homing <onboarding@homing.dev>',
  to,
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
})
console.log('queued:', id)

const deadline = Date.now() + 60_000
while (Date.now() < deadline) {
  const email = await homing.emails.get(id)
  if (email.status === 'sent') {
    console.log(`sent after ${email.attempts} attempt(s)`)
    process.exit(0)
  }
  if (email.status === 'failed') {
    console.error('failed:', email.last_error)
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 1000))
}
console.error('still not sent after 60s')
process.exit(1)
