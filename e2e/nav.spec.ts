import { test, expect } from '@playwright/test'

// Prev/next problem navigation in the quiz header, and the guarantee that nav
// buttons don't keep focus (else a Space/Enter used to dismiss a popup would
// re-fire the last-clicked button).
test('quiz prev/next navigation; nav buttons never retain focus', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.getByRole('button', { name: /^QuizB/ }).click()
  await page.getByRole('button', { name: 'In Order' }).click()

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

// sources → quizzes → one quiz → a run, and back down the same steps: every back
// button goes exactly one level up, to wherever the run was started.
test('the four levels, and back one step at a time', async ({ page }) => {
  await page.goto('/')
  await page.getByText('FakeBook').click()
  // The quizzes list is just a list — no start buttons on the rows.
  await expect(page.locator('.problem-row')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'In Order' })).toHaveCount(0)

  // A quiz's own screen: its title, its source, and the four ways to run it.
  await page.getByRole('button', { name: /^QuizB/ }).click()
  await expect(page.locator('.source-head-title')).toHaveText('QuizB')
  await expect(page.locator('.quiz-view-sub')).toContainText('FakeBook')
  for (const name of ['In Order', 'Random', 'PDF']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeEnabled()
  }

  await page.getByRole('button', { name: 'In Order' }).click()
  await expect(page.locator('.qbtn-label')).toHaveText('QuizB #1')

  // Back → the quiz screen it was launched from (not the quizzes list).
  await page.getByRole('button', { name: 'Back to quiz' }).click()
  await expect(page.locator('.source-head-title')).toHaveText('QuizB')
  // Back again → the source's quizzes.
  await page.getByRole('button', { name: '‹ FakeBook' }).click()
  await expect(page.locator('.source-head-title')).toHaveText('FakeBook')

  // A source-wide run was launched here, so it comes back here.
  await page.locator('.source-random').click()
  await page.getByRole('button', { name: 'Back to quizzes' }).click()
  await expect(page.locator('.source-head-title')).toHaveText('FakeBook')

  // A library-wide run was launched from the sources list, so it returns there.
  await page.getByRole('button', { name: '‹ Sources' }).click()
  await page.locator('.source-random').click()
  await expect(page.locator('.qbtn-label')).toHaveText('All · random #1')
  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page.getByText('FakeBook')).toBeVisible()
  await expect(page.locator('.source-head-title')).toHaveCount(0) // sources list
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
