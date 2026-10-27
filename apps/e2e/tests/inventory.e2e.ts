import { expect, test, type Page } from '@playwright/test';
import { storageState } from './accounts.js';

async function search(page: Page, term: string) {
  await page.getByLabel('ค้นหา SKU ชื่อสินค้า หรือสาขา').fill(term);
  await page.getByRole('button', { name: 'ค้นหา' }).click();
}

test.describe('inventory', () => {
  test.use({ storageState: storageState('admin') });

  test('stock search by SKU/name/store shows quantity, unit, threshold, and low-stock status', async ({
    page,
  }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'สต็อกสินค้า' })).toBeVisible();

    // By SKU: SKU001 has 10 packs in B01 (threshold 3, not low) and nothing in B02.
    await search(page, 'SKU001');
    const waterB01 = page.getByRole('row', { name: /^SKU001 .* B01 / });
    await expect(waterB01.getByRole('cell', { name: '10', exact: true })).toBeVisible();
    await expect(waterB01.getByRole('cell', { name: 'แพ็ค', exact: true })).toBeVisible();
    await expect(waterB01.getByRole('cell', { name: '3', exact: true })).toBeVisible();
    await expect(waterB01.getByText('ปกติ')).toBeVisible();
    const waterB02 = page.getByRole('row', { name: /^SKU001 .* B02 / });
    await expect(waterB02.getByRole('cell', { name: '0', exact: true })).toBeVisible();
    await expect(waterB02.getByText('สต็อกต่ำ')).toBeVisible();

    // By product name: laundry detergent is out of stock in B01, at or under its threshold.
    await search(page, 'น้ำยาซักผ้า');
    const detergentB01 = page.getByRole('row', { name: /^SKU003 .* B01 / });
    await expect(detergentB01.getByRole('cell', { name: '0', exact: true })).toBeVisible();
    await expect(detergentB01.getByRole('cell', { name: 'ถุง', exact: true })).toBeVisible();
    await expect(detergentB01.getByText('สต็อกต่ำ')).toBeVisible();

    // By store: only Riverside rows.
    await search(page, 'B02');
    await expect(page.getByRole('row', { name: /^SKU002 .* B02 / })).toBeVisible();
    await expect(page.getByRole('row', { name: /^SKU002 .* B01 / })).toHaveCount(0);

    // The scripted movement and the Postgres harness halves of the Demo line are proven at
    // seam 4 (apps/api/src/inventory/*.integration.spec.ts): there is no stock-writing screen yet.
  });
});
