import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { chromium, Browser, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
// Use resolved address to avoid ENS flaky resolution during E2E tests
const TEST_ADDRESS = '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3'; // deanpierce.eth

describe('End-to-End Verification: No Demo Data', async () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    before(async () => {
        // Ensure server is reachable
        try {
            const resp = await fetch(`${BASE_URL}/api/health_check_or_root`); // Just fetch root to check
        } catch (e) {
            console.log("Server not reachable at localhost:3000. Please start 'npm run dev'.");
            // We won't throw here to allow partial (API) tests if browser fails, 
            // but realistically we need the server.
        }

        browser = await chromium.launch({ headless: true }); // Headless for CI/Script consistency
        context = await browser.newContext();
        page = await context.newPage();
    });

    after(async () => {
        if (browser) await browser.close();
    });

    describe('API Level Checks', () => {
        it('Alchemy API should return error NO_API_KEY and NO demo data', async () => {
            const res = await fetch(`${BASE_URL}/api/services/alchemy?address=${TEST_ADDRESS}`);
            const data: any = await res.json();

            assert.strictEqual(res.status, 200);
            const isApiKeyError = data.error === 'NO_API_KEY' || data.error === 'API_ERROR';
            assert.ok(isApiKeyError, `Expected NO_API_KEY or API_ERROR, got ${data.error}`);

            assert.strictEqual(data.nfts.length, 0, 'Should have 0 NFTs');
            assert.strictEqual(data.source, 'none');

            // Check specific fake data points known from previous versions
            const hasFakeApe = data.nfts?.some((n: any) => n.name.includes('Bored Ape'));
            assert.strictEqual(hasFakeApe, false, 'Should NOT contain Bored Ape demo data');
        });

        it('OpenSea API should return error API_INTEGRATION_PENDING (or KEY_REQUIRED) and NO demo data', async () => {
            const res = await fetch(`${BASE_URL}/api/services/opensea?address=${TEST_ADDRESS}`);
            const data: any = await res.json();

            // Depending on env vars, might be NO_API_KEY or PENDING
            // But definitely not demo data.
            const isErrorState = data.error === 'OPENSEA_API_KEY_REQUIRED' || data.error === 'API_INTEGRATION_PENDING';
            assert.ok(isErrorState, `Expected error state, got ${data.error}`);

            assert.deepStrictEqual(data.topValuedNFTs, []);
            assert.strictEqual(data.marketStats.totalNFTs, 0);
            assert.strictEqual(data.source, 'none');
        });

        it('DeBank API should return error API_INTEGRATION_PENDING and NO demo data', async () => {
            const res = await fetch(`${BASE_URL}/api/services/debank?address=${TEST_ADDRESS}`);
            const data: any = await res.json();

            assert.strictEqual(data.error, 'API_INTEGRATION_PENDING');
            assert.strictEqual(data.totalUSD, 0);
            assert.deepStrictEqual(data.topTokens, []);
            assert.strictEqual(data.source, 'none');
        });
    });

    describe('Frontend Visual Checks', () => {
        it('Should display "No API Key" / "Pending Integration" messages on cards', async () => {
            await page.goto(`${BASE_URL}/${TEST_ADDRESS}?refresh=true`);

            // Wait for hydration and data load
            // The cards show "Loading..." initially, then update.
            // We wait for a specific selector or text that appears when loaded.

            // Check Alchemy Card
            // Expect to find "API Key Required" text inside the Alchemy card area
            // We can search for the text generally or scope it.
            try {
                // Wait for any service card to load to be safe
                await page.waitForSelector('text=API Key Required', { timeout: 10000 });
            } catch (e) {
                // Ignore timeout if it's just one card, we verify assert below
            }

            const alchemyContent = await page.content();
            // Alchemy might show "API Key Required" (if NO_API_KEY) or "Service Error" (if API_ERROR)
            assert.ok(
                alchemyContent.includes('API Key Required') ||
                alchemyContent.includes('No API Key Configured') ||
                alchemyContent.includes('Service Error'),
                'Alchemy card should show API Key warning or Service Error'
            );

            // Check OpenSea Card
            const openSeaText = await page.getByText('Pending API Integration').count();
            // Note: We used "Pending API Integration" in the footer logic I added.
            // Also "Integration in Progress" in the body for OpenSea.

            // We can use more specific locators if needed, but text presence is a good start.
            const bodyText = await page.innerText('body');

            assert.ok(bodyText.includes('Pending API Integration'), 'Should show Pending API Integration status');
            assert.ok(bodyText.includes('Real OpenSea data integration is being implemented'), 'Should show OpenSea specific pending message');

            // Check DeBank Card
            assert.ok(bodyText.includes('Real DeBank portfolio data integration is coming soon'), 'Should show DeBank specific pending message');

            // Crucially: Assert NO Fake Data
            assert.ok(!bodyText.includes('Bored Ape'), 'UI should NOT show Bored Ape');
            assert.ok(!bodyText.includes('CyberPunk'), 'UI should NOT show CyberPunk');
            assert.ok(!bodyText.includes('$17,380.20'), 'UI should NOT show fake portfolio value');
        });
    });
});
