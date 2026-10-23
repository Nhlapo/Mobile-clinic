import { chromium, expect } from '@playwright/test';
import { createApp } from '../server/index.js';
import { openDb } from '../server/db.js';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

mkdirSync('test-results', { recursive: true });
const db = openDb(':memory:');
const server = createApp(db).listen(0);
await new Promise(resolve => server.once('listening', resolve));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const widths = [320, 375, 430, 768, 1024, 1280, 1440];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function noOverflow(label) {
    const result = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(result.content <= result.width + 1, `${label}: ${JSON.stringify(result)}`);
  }
  await page.goto(base);
  await page.locator('app-service-card').last().waitFor();
  assert.equal(await page.locator('app-service-card').count(), 6);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(`Home ${width}`);
    for (const section of await page.locator('app-home section').all()) await section.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/redesign-home-${width}.png`, fullPage: true });
    const broken = await page.locator('app-home img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src));
    assert.deepEqual(broken, []);
    if (width < 1024) {
      const toggle = page.getByRole('button', { name: 'Toggle navigation' });
      await toggle.click();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      assert.equal(await toggle.evaluate(el => document.activeElement === el), true);
      await toggle.click();
      await page.locator('#main-navigation').getByRole('link', { name: 'Services', exact: true }).click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    await page.getByRole('button', { name: 'Learn more about Wound care', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await noOverflow(`Service dialog ${width}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Learn more about Wound care', exact: true }).click();
  await page.getByRole('button', { name: 'Book this care' }).click();
  await page.getByRole('heading', { name: 'What care do you need?' }).waitFor();
  await expect(page.locator('.booking-services .selected')).toContainText('Wound care');
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`Booking ${width}`);
  }
  await page.screenshot({ path: 'test-results/redesign-booking.png', fullPage: true });
  await page.locator('#main-navigation').getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('UI Test Patient');
  await page.getByLabel('Email address').fill('ui-patient@example.test');
  await page.getByLabel('Password', { exact: true }).fill('A-ui-test-password');
  await page.getByRole('button', { name: 'Create account', exact: false }).click();
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor();
  await page.getByRole('button', { name: 'Profile', exact: false }).click();
  await page.getByLabel('Mobile number').fill('0821234567');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('status').waitFor();
  assert.equal(db.prepare('SELECT phone FROM users WHERE email=?').get('ui-patient@example.test').phone, '0821234567');
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(`Patient profile ${width}`);
  }
  await page.screenshot({ path: 'test-results/redesign-patient.png', fullPage: true });
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto(base + '/#login');
  await page.getByLabel('Email address').waitFor();
  await page.goto(base + '/#book');
  await page.getByRole('heading', { name: 'What care do you need?' }).waitFor();
  await page.goBack();
  await page.getByLabel('Email address').waitFor();
  assert.deepEqual(errors, []);
  console.log('UI checks passed: seven widths, images, navigation, keyboard, service details, booking selection, registration, profile persistence and logout.');
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
  db.close();
}
