import { chromium } from 'playwright'
const OUT = '/private/tmp/claude-501/-Users-joel-src-bidmonkey/e3cbbfe3-955f-49ee-9191-92a0b2e3d481/scratchpad'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
await p.goto('http://localhost:5174', { waitUntil: 'networkidle' })
await p.getByText('Choose your opening lead').click()
await p.waitForTimeout(300)
await p.getByText('Play the hand').click()
await p.waitForTimeout(400)
await p.locator('.opt-grid .opt-btn').nth(0).click()  // lead HQ
await p.waitForTimeout(250)
await p.screenshot({ path: `${OUT}/s-answer.png` })    // Correct! popup (test keypress dismiss)
await p.keyboard.press('Enter')                         // keypress should dismiss the answer
await p.waitForTimeout(2500)
await p.screenshot({ path: `${OUT}/s-trick.png` })      // trick in progress: N/S centered? bigger?
await b.close(); console.log('done')
