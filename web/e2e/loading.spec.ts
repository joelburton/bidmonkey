import { test, expect } from '@playwright/test'

// Content is fetched from Supabase, so a failed/paused backend must degrade to a
// clear error + retry rather than a blank or broken page.
test('shows an error with retry when content fails to load, then recovers', async ({
  page,
}) => {
  // Force the content fetch to fail (simulate a down / paused backend).
  await page.route(/\/rest\/v1\//, (r) => r.fulfill({ status: 500, body: 'boom' }))
  await page.goto('/')

  await expect(page.getByText(/Couldn.t load problems/)).toBeVisible()
  const retry = page.getByRole('button', { name: 'Retry' })
  await expect(retry).toBeVisible()

  // Stop forcing failures → retry loads real content from local Supabase.
  await page.unroute(/\/rest\/v1\//)
  await retry.click()
  await expect(page.getByText('FakeBook')).toBeVisible()
})
