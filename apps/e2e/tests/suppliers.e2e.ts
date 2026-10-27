import { expect, test } from '@playwright/test';
import { storageState } from './accounts.js';

test.describe('suppliers', () => {
  test.use({ storageState: storageState('admin') });

  test('an Administrator creates SUP01 SupplyOne Co Ltd and sees it in the supplier list', async ({
    page,
  }) => {
    // This test's own row, unique so it never collides with another run.
    const code = `SUP-${Date.now()}`;
    const name = 'SupplyOne Co Ltd';

    await page.goto('/suppliers');
    await expect(page.getByRole('heading', { name: 'ผู้ขาย' })).toBeVisible();

    await page.getByLabel('รหัสผู้ขาย').fill(code);
    await page.getByLabel('ชื่อผู้ขาย').fill(name);
    await page.getByRole('button', { name: 'เพิ่มผู้ขาย' }).click();

    // The new supplier appears as a row in the newest-first list.
    await expect(page.getByRole('listitem').filter({ hasText: code })).toBeVisible();

    // A second supplier with the same code is rejected with the Thai envelope.
    await page.getByLabel('รหัสผู้ขาย').fill(code);
    await page.getByLabel('ชื่อผู้ขาย').fill('ผู้ขายซ้ำ');
    await page.getByRole('button', { name: 'เพิ่มผู้ขาย' }).click();
    await expect(page.getByRole('alert')).toContainText('รหัสผู้ขายนี้ถูกใช้แล้ว');
  });
});
