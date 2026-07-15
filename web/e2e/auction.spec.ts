import { test, expect } from '@playwright/test'

test.describe('auction', () => {
  test('multiple-choice: wrong then correct, then continues to the next question', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByText('Two decisions').click()

    // First question: options a-d; the auction table shows one round so far.
    await expect(page.locator('.opt-btn')).toHaveCount(4)
    await expect(page.locator('.auction-table tbody tr')).toHaveCount(1)

    await page.locator('.opt-btn').nth(1).click() // wrong (1NT)
    await expect(page.getByText('Not quite')).toBeVisible()
    await page.keyboard.press('Escape') // dismiss -> retry
    await expect(page.getByText('Not quite')).toBeHidden()

    await page.locator('.opt-btn').first().click() // correct (1S)
    await expect(page.getByText('Correct!')).toBeVisible()
    await page.keyboard.press('Escape') // dismiss -> advance

    // The auction advanced: a second round appears with another question.
    await expect(page.locator('.auction-table tbody tr')).toHaveCount(2)
    await expect(page.locator('.ask')).toBeVisible()
  })

  test('back to the list when there are not four hands', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Two decisions').click()

    await page.locator('.opt-btn').first().click() // q1: 1S
    await page.keyboard.press('Escape')
    await expect(page.locator('.auction-table tbody tr')).toHaveCount(2) // advanced

    await page.locator('.opt-btn').nth(1).click() // q2: 2NT
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /Back to problems/ })).toBeVisible()
  })
})
