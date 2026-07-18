import { test, expect } from '@playwright/test'

// A wide desktop window: the app must stay a centered portrait column, with the
// options and both side rails inside it (they used to overflow off the right).
test.use({ viewport: { width: 1280, height: 800 } })

test('desktop keeps a centered portrait layout that fits', async ({ page }) => {
  await page.goto('/')
  // Sources → quizzes → QuizB #2 is "Choose your opening lead".
  await page.getByText('FakeBook').click()
  await page.locator('.quiz-row', { hasText: 'QuizB' }).getByRole('button', { name: 'In Order' }).click()
  await page.getByRole('button', { name: 'Next problem' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.center-opts .opt-btn')).toHaveCount(4)

  const vw = page.viewportSize()!.width
  const app = (await page.locator('.app').boundingBox())!

  // Narrower than the viewport, centered (margins on both sides).
  expect(app.width).toBeLessThan(vw)
  expect(app.x).toBeGreaterThan(0)
  expect(Math.round(app.x + app.width)).toBeLessThanOrEqual(vw)

  // Options fit inside the app (they were cut off on the right).
  const opt = (await page.locator('.center-opts .opt-btn').last().boundingBox())!
  expect(opt.x + opt.width).toBeLessThanOrEqual(app.x + app.width + 1)

  // Both rails render within the app's right/left half.
  const east = (await page.locator('.rail-east').boundingBox())!
  expect(east.x).toBeGreaterThan(app.x + app.width / 2)
  expect(east.x).toBeLessThan(app.x + app.width)
})
