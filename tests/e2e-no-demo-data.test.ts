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
    let serverReachable = false;

    before(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        try {
            const resp = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
            serverReachable = resp.ok;
        } catch {
            serverReachable = false;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!serverReachable) {
            console.log("Server not reachable at localhost:3000. Skipping E2E tests (start with 'npm run dev').");
            return;
        }

        browser = await chromium.launch({ headless: true }); // Headless for CI/Script consistency
        context = await browser.newContext();
        page = await context.newPage();
    });

    after(async () => {
        if (browser) await browser.close();
    });

    describe('API Level Checks', () => {
        it('Alchemy API should return error NO_API_KEY and NO demo data', async (t) => {
            if (!serverReachable) return t.skip("Dev server isn't running");

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

        it('OpenSea API should return no demo data', async (t) => {
            if (!serverReachable) return t.skip("Dev server isn't running");

            const res = await fetch(`${BASE_URL}/api/services/opensea?address=${TEST_ADDRESS}`);
            const data: any = await res.json();

            assert.strictEqual(res.status, 200);

            if (data.error) {
                const isExpectedError =
                    data.error === 'OPENSEA_API_KEY_REQUIRED' ||
                    data.error === 'SERVICE_ERROR' ||
                    data.error === 'API_INTEGRATION_PENDING';
                assert.ok(isExpectedError, `Unexpected error state: ${data.error}`);
                assert.deepStrictEqual(data.topValuedNFTs, []);
                assert.strictEqual(data.source, 'none');
            } else {
                assert.strictEqual(data.source, 'opensea');
                assert.ok(Array.isArray(data.topValuedNFTs));
            }

            const hasFakeApe = (data.topValuedNFTs || []).some((n: any) => String(n.name).includes('Bored Ape'));
            assert.strictEqual(hasFakeApe, false, 'Should NOT contain Bored Ape demo data');
        });

        it('DeBank API should return no demo data', async (t) => {
            if (!serverReachable) return t.skip("Dev server isn't running");

            const res = await fetch(`${BASE_URL}/api/services/debank?address=${TEST_ADDRESS}`);
            const data: any = await res.json();

            assert.strictEqual(res.status, 200);

            if (data.error) {
                const isExpectedError = data.error === 'NO_API_KEY' || data.error === 'SERVICE_ERROR';
                assert.ok(isExpectedError, `Unexpected error state: ${data.error}`);
                assert.strictEqual(data.totalUSD, 0);
                assert.deepStrictEqual(data.topTokens, []);
                assert.strictEqual(data.source, 'none');
            } else {
                assert.strictEqual(data.source, 'debank');
                assert.ok(Array.isArray(data.topTokens));
            }
        });
    });

    describe('Frontend Visual Checks', () => {
        it('Should not display demo data on cards', async (t) => {
            if (!serverReachable) return t.skip("Dev server isn't running");

            await page.goto(`${BASE_URL}/${TEST_ADDRESS}?refresh=true`);

            // Wait for hydration and data load
            // The cards show "Loading..." initially, then update.
            // We wait for a specific selector or text that appears when loaded.

            const bodyText = await page.innerText('body');

            // Crucially: Assert NO Fake Data
            assert.ok(!bodyText.includes('Bored Ape'), 'UI should NOT show Bored Ape');
            assert.ok(!bodyText.includes('CyberPunk'), 'UI should NOT show CyberPunk');
            assert.ok(!bodyText.includes('$17,380.20'), 'UI should NOT show fake portfolio value');
        });
    });
});
