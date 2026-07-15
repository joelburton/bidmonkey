import { test, expect } from '@playwright/test'
import { stubSupabase } from './fixtures'

test.describe('play phase', () => {
  test('opening lead: shows multiple-choice options and plays through the trick', async ({
    page,
  }) => {
    await stubSupabase(page)
    await page.goto('/')
    // Sources → quizzes → QuizB #2 is "Choose your opening lead".
    await page.getByText('FakeBook').click()
    await page.getByText('QuizB').click()
    await page.getByRole('button', { name: 'Next problem' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    // The lead is a multiple-choice question: options in the center, not free
    // choice — the hero's hand is shown but not clickable.
    await expect(page.getByText('Choose your opening lead.')).toBeVisible()
    await expect(page.locator('.center-opts .opt-btn')).toHaveCount(4)
    await expect(page.locator('.rail-south .slot.playable')).toHaveCount(0)

    // Options must be fully on-screen (regression: they were pushed off the
    // bottom on short viewports).
    const viewport = page.viewportSize()!
    const box = (await page.locator('.center-opts .opt-btn').last().boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

    // Choose the correct lead (option a = ♥Q); expect the "Correct!" popup.
    await page.locator('.center-opts .opt-btn').first().click()
    await expect(page.getByText('Correct!')).toBeVisible()

    // A keypress dismisses the popup and the lead is played; the dummy appears.
    await page.keyboard.press('Enter')
    await expect(page.locator('.trick-b .card')).toBeVisible() // our lead on the table
  })
})
