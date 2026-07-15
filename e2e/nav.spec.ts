import { test, expect } from '@playwright/test'

// Prev/next problem navigation in the quiz header, and the guarantee that nav
// buttons don't keep focus (else a Space/Enter used to dismiss a popup would
// re-fire the last-clicked button).
test('quiz prev/next navigation; nav buttons never retain focus', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.getByText('QuizB').click()

  const prev = page.getByRole('button', { name: 'Previous problem' })
  const next = page.getByRole('button', { name: 'Next problem' })

  // #1: prev disabled (first), next enabled.
  await expect(page.locator('.quiz-title')).toHaveText('QuizB #1')
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()

  await next.click()
  await expect(page.locator('.quiz-title')).toHaveText('QuizB #2')
  // The clicked button must not have taken focus.
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe(
    'Next problem',
  )

  await prev.click()
  await expect(page.locator('.quiz-title')).toHaveText('QuizB #1')

  // Last problem: next disabled, prev enabled.
  await next.click()
  await next.click()
  await expect(page.locator('.quiz-title')).toHaveText('QuizB #3')
  await expect(next).toBeDisabled()
  await expect(prev).toBeEnabled()
})
