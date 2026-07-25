import { test, expect } from '@playwright/test'

// Prev/next problem navigation in the quiz header, and the guarantee that nav
// buttons don't keep focus (else a Space/Enter used to dismiss a popup would
// re-fire the last-clicked button).
test('quiz prev/next navigation; nav buttons never retain focus', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.locator('.quiz-row', { hasText: 'QuizB' }).getByRole('button', { name: 'In Order' }).click()

  const prev = page.getByRole('button', { name: 'Previous problem' })
  const next = page.getByRole('button', { name: 'Next problem' })

  // #1: prev disabled (first), next enabled.
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #1')
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()

  await next.click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #2')
  // The clicked button must not have taken focus.
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe(
    'Next problem',
  )

  await prev.click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #1')

  // Last problem (QuizB has 4): next disabled, prev enabled.
  await next.click()
  await next.click()
  await next.click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #4')
  await expect(next).toBeDisabled()
  await expect(prev).toBeEnabled()
})

// The header's back button goes one level up — to the quizzes of the source the
// run came from, not all the way to the sources list.
test('back from a run returns to the source, not the sources list', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.locator('.quiz-row', { hasText: 'QuizB' }).getByRole('button', { name: 'In Order' }).click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #1')

  await page.getByRole('button', { name: 'Back to quizzes' }).click()
  // The source's quiz list, not the sources list.
  await expect(page.locator('.source-head-title')).toHaveText('FakeBook')
  await expect(page.locator('.quiz-row')).toHaveCount(3)

  // A source-wide random run comes back to the same place.
  await page.locator('.source-random').click()
  await page.getByRole('button', { name: 'Back to quizzes' }).click()
  await expect(page.locator('.source-head-title')).toHaveText('FakeBook')
})

// A Random run across the whole source draws from every problem in it (FakeBook
// has 7), independent of the quizzes — the header labels it "<Source> · random".
test('random run across a whole source', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()

  await expect(page.locator('.source-random')).toHaveText('🎲 Random (7)')
  await page.locator('.source-random').click()

  const prev = page.getByRole('button', { name: 'Previous problem' })
  const next = page.getByRole('button', { name: 'Next problem' })

  await expect(page.locator('.qbtn-label')).toHaveText('FakeBook · random #1')
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()

  // Walk to the last of the 7; next then disabled.
  for (let i = 0; i < 6; i++) await next.click()
  await expect(page.locator('.qbtn-label')).toHaveText('FakeBook · random #7')
  await expect(next).toBeDisabled()
  await expect(prev).toBeEnabled()
})
