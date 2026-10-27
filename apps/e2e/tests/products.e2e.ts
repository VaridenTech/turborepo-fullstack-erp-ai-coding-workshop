import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

test.describe('products', () => {
  test.use({ storageState: storageState('admin') });

  test('an Administrator creates products with the Section 8.1 prices, deactivates one, and it stays searchable', async ({
    page,
  }) => {
    // This run's own SKUs, unique so they never collide with another run.
    const suffix = Date.now();
    const detergent = { sku: `SKU003-${suffix}`, name: 'น้ำยาซักผ้า', price: '120.00' };
    const products = [
      { sku: `SKU001-${suffix}`, name: 'น้ำดื่มแพ็ค 6', price: '60.00' },
      { sku: `SKU002-${suffix}`, name: 'กระดาษทิชชู่', price: '35.00' },
      detergent,
    ];

    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'สินค้า' })).toBeVisible();

    for (const product of products) {
      await page.getByLabel('รหัสสินค้า (SKU)').fill(product.sku);
      await page.getByLabel('ชื่อสินค้า').fill(product.name);
      await page.getByLabel('หมวดหมู่').fill('ทั่วไป');
      await page.getByLabel('หน่วย').fill('แพ็ค');
      await page.getByLabel('ราคาขาย').fill(product.price);
      await page.getByRole('button', { name: 'เพิ่มสินค้า' }).click();
      await expect(page.getByRole('listitem').filter({ hasText: product.sku })).toBeVisible();
    }

    // Deactivate SKU003; it stays in the list (searchable in history, MD-02).
    await page.getByRole('button', { name: `ปิดการใช้งาน ${detergent.sku}` }).click();
    await expect(page.getByRole('listitem').filter({ hasText: detergent.sku })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `เปิดการใช้งาน ${detergent.sku}` }),
    ).toBeVisible();

    // The "cannot be added to a new document" half of the Demo is proven at seam 1
    // by assertProductUsableInDocument (products.controller.spec.ts); there is no
    // document screen until #6/#8/#11, so it is not observable in the browser yet.
  });
});
