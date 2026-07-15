import { test, expect } from '@playwright/test'
import { stubSupabase } from './fixtures'

// Content is fetched from Supabase, so a failed/paused backend must degrade to a
// clear error + retry rather than a blank or broken page.
test('shows an error with retry when content fails to load, then recovers', async ({
  page,
}) => {
  await page.route(/\/rest\/v1\//, (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')

  await expect(page.getByText(/Couldn.t load problems/)).toBeVisible()
  const retry = page.getByRole('button', { name: 'Retry' })
  await expect(retry).toBeVisible()

  // Backend recovers → retry loads the content.
  await stubSupabase(page)
  await retry.click()
  await expect(page.getByText('FakeBook')).toBeVisible()
})
