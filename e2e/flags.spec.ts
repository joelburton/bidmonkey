import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// The review list. Unlike the rest of the suite these tests WRITE to the local
// DB — problem_flags is the one table the app writes to — so they run in order
// and hand state to each other, and they use QuizC (a single problem, untouched
// by the other specs) so a parallel spec can't disturb the flag under test.
test.describe.configure({ mode: 'serial' })

// FakeBook → QuizC → its one problem (a free-form question; option a is wrong).
async function gotoQuizC(page: Page) {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.getByRole('button', { name: /^QuizC/ }).click()
  await page.getByRole('button', { name: 'In Order' }).click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizC #1')
}

test('a wrong answer flags the problem, and the flag outlives a reload', async ({ page }) => {
  await gotoQuizC(page)
  const flag = page.locator('.flag-btn')
  await expect(flag).toHaveAttribute('aria-pressed', 'false')

  await page.locator('.opt-btn').first().click() // option a — wrong
  await expect(page.getByText('Not quite')).toBeVisible()
  await expect(flag).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')

  // Reload and come back: the flag was written, not just held in memory (this is
  // the round trip through PostgREST, RLS and the anon write grants).
  await gotoQuizC(page)
  await expect(page.locator('.flag-btn')).toHaveAttribute('aria-pressed', 'true')
})

test('the ⚑ button unflags, Shift+F flags again', async ({ page }) => {
  await gotoQuizC(page)
  const flag = page.locator('.flag-btn')
  await expect(flag).toHaveAttribute('aria-pressed', 'true') // left flagged above

  await flag.click()
  await expect(flag).toHaveAttribute('aria-pressed', 'false')
  await gotoQuizC(page) // the unflag persisted too
  await expect(page.locator('.flag-btn')).toHaveAttribute('aria-pressed', 'false')

  await page.keyboard.press('Shift+F')
  await expect(page.locator('.flag-btn')).toHaveAttribute('aria-pressed', 'true')
  await gotoQuizC(page)
  await expect(page.locator('.flag-btn')).toHaveAttribute('aria-pressed', 'true')
})

test("a quiz's own screen runs just its flagged problems", async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.getByRole('button', { name: /^QuizC/ }).click()

  // QuizC holds one problem, flagged by the tests above.
  const flagged = page.getByRole('button', { name: 'Flagged (1)' })
  await expect(flagged).toBeEnabled()
  await flagged.click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizC · flagged #1')
  // One problem, so it's the only stop in the run.
  await expect(page.getByRole('button', { name: 'Next problem' })).toBeDisabled()
})

test('the source header runs the flagged problems', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()

  // At least the problem flagged above is listed (other specs answer wrongly too,
  // so the exact count isn't ours to assert).
  const flagged = page.locator('.source-flagged')
  await expect(flagged).toBeEnabled()
  await expect(flagged).toHaveText(/Flagged \([1-9]\d*\)/)

  await flagged.click()
  await expect(page.locator('.qbtn-label')).toHaveText(/^FakeBook · flagged #1$/)
  await expect(page.getByRole('button', { name: 'Previous problem' })).toBeDisabled()
})

test('the sources list runs every flagged problem, any source', async ({ page }) => {
  await page.goto('/')
  const flagged = page.locator('.source-flagged')
  await expect(flagged).toBeEnabled()
  await expect(flagged).toHaveText(/Flagged \([1-9]\d*\)/)

  await flagged.click()
  await expect(page.locator('.qbtn-label')).toHaveText(/^All · flagged #1$/)
})
