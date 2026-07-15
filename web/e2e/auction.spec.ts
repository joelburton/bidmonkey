import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { stubSupabase } from './fixtures'

// "Two decisions" is QuizB #3 (FakeBook → QuizB, then Next twice).
async function gotoTwoDecisions(page: Page) {
  await stubSupabase(page)
  await page.goto('/')
  await page.getByText('FakeBook').click()
  await page.getByText('QuizB').click()
  await page.getByRole('button', { name: 'Next problem' }).click()
  await page.getByRole('button', { name: 'Next problem' }).click()
  await expect(page.locator('.quiz-title')).toHaveText('QuizB #3')
}

test.describe('auction', () => {
  test('multiple-choice: wrong then correct, then continues to the next question', async ({
    page,
  }) => {
    await gotoTwoDecisions(page)

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

  test('bidding-only problem: no play offered when there are not four hands', async ({
    page,
  }) => {
    await gotoTwoDecisions(page)

    await page.locator('.opt-btn').first().click() // q1: 1S
    await page.keyboard.press('Escape')
    await expect(page.locator('.auction-table tbody tr')).toHaveCount(2) // advanced

    await page.locator('.opt-btn').nth(1).click() // q2: 2NT
    await page.keyboard.press('Escape')

    // Auction complete, no fourth hand → no "Play" button; nav is in the header.
    await expect(page.getByText('Bidding complete.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0)
    // Last problem of the quiz → Next is disabled, Home (‹) still available.
    await expect(page.getByRole('button', { name: 'Next problem' })).toBeDisabled()
  })
})
