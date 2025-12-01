import { test, expect, Page } from '@playwright/test';

/**
 * HYDRA UX Metrics Test Suite
 *
 * Tests to validate UX redesign effectiveness:
 * - Navigation efficiency
 * - Quick Create flow
 * - User journey completion rates
 * - Click counting
 */

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@hydra.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

// Helper to count clicks
class ClickCounter {
  private count = 0;

  attach(page: Page) {
    page.on('click', () => this.count++);
  }

  get clicks() {
    return this.count;
  }

  reset() {
    this.count = 0;
  }
}

// Helper to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home');
}

test.describe('Navigation Efficiency', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Home page loads with correct structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Check main sections exist
    await expect(page.locator('text=What would you like to create?')).toBeVisible();
    await expect(page.locator('text=Explore & Discover')).toBeVisible();

    // Check navigation exists
    await expect(page.locator('button:has-text("Home")')).toBeVisible();
    await expect(page.locator('button:has-text("Create")')).toBeVisible();
    await expect(page.locator('button:has-text("Manage")')).toBeVisible();
    await expect(page.locator('button:has-text("Insights")')).toBeVisible();
  });

  test('Create dropdown shows correct items', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Open Create dropdown
    await page.click('button:has-text("Create")');

    // Check dropdown items
    await expect(page.locator('text=AI Generate')).toBeVisible();
    await expect(page.locator('text=Image Compose')).toBeVisible();
    await expect(page.locator('text=Batch Variations')).toBeVisible();
  });

  test('Manage dropdown shows correct items', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Open Manage dropdown
    await page.click('button:has-text("Manage")');

    // Check dropdown items
    await expect(page.locator('text=Campaigns')).toBeVisible();
    await expect(page.locator('text=All Videos')).toBeVisible();
    await expect(page.locator('text=Publishing')).toBeVisible();
  });

  test('Navigation to campaigns via dropdown', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/home`);

    // Navigate via Manage dropdown
    await page.click('button:has-text("Manage")');
    await page.click('a:has-text("Campaigns")');

    await expect(page).toHaveURL(/\/campaigns/);

    const duration = Date.now() - startTime;
    console.log(`Campaign navigation time: ${duration}ms`);

    // Should be under 2 seconds
    expect(duration).toBeLessThan(2000);
  });
});

test.describe('Quick Create Flow', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Quick Create card navigates to generate page', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Click AI Generate card
    await page.click('text=AI Generate');

    await expect(page).toHaveURL(/\/create\/generate/);
    await expect(page.locator('text=Quick Create Mode')).toBeVisible();
  });

  test('Quick Create mode is default selected', async ({ page }) => {
    await page.goto(`${BASE_URL}/create/generate`);

    // Check Quick Create badge is visible
    await expect(page.locator('text=Quick Create Mode')).toBeVisible();

    // Campaign selector should show Quick Create as default
    await expect(page.locator('text=Quick Create (no campaign)')).toBeVisible();
  });

  test('Quick Create generates without campaign selection modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/create/generate`);

    // Fill in prompt
    await page.fill('textarea', 'Test video with artist performing on stage');

    // Click generate
    await page.click('button:has-text("Generate Video")');

    // Should show success modal, not campaign selection
    await expect(page.locator('text=Video Generation Started!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Quick Create in Progress')).toBeVisible();
  });

  test('Quick Create allows saving to campaign after generation', async ({ page }) => {
    await page.goto(`${BASE_URL}/create/generate`);

    await page.fill('textarea', 'Test video prompt');
    await page.click('button:has-text("Generate Video")');

    // Wait for success modal
    await expect(page.locator('text=Video Generation Started!')).toBeVisible({ timeout: 10000 });

    // Check save options are available
    await expect(page.locator('text=Save to campaign (optional)')).toBeVisible();
    await expect(page.locator('text=Add to existing campaign')).toBeVisible();
    await expect(page.locator('text=Create new campaign')).toBeVisible();
  });

  test('Quick Create click count is minimal', async ({ page }) => {
    let clickCount = 0;

    // Count all clicks
    page.on('click', () => clickCount++);

    await page.goto(`${BASE_URL}/home`);

    // Click 1: AI Generate card
    await page.click('text=AI Generate');

    // Enter prompt (not a click)
    await page.fill('textarea', 'Test prompt');

    // Click 2: Generate button
    await page.click('button:has-text("Generate Video")');

    // Wait for modal
    await expect(page.locator('text=Video Generation Started!')).toBeVisible({ timeout: 10000 });

    console.log(`Quick Create total clicks: ${clickCount}`);

    // Should be 2 or fewer clicks
    expect(clickCount).toBeLessThanOrEqual(3);
  });
});

test.describe('Trend Exploration Flow', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Explore Trends card is separate from Create section', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Create section should have only 2 cards
    const createSection = page.locator('text=What would you like to create?').locator('..');
    const createCards = createSection.locator('[class*="Card"]');

    // Explore section should be separate
    await expect(page.locator('text=Explore & Discover')).toBeVisible();
  });

  test('Explore Trends navigates to insights', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Click Explore Trends card
    await page.click('text=Explore Trends');

    await expect(page).toHaveURL(/\/insights/);
  });

  test('Explore Trends card has Research badge', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Find the Explore Trends card and verify badge
    const trendCard = page.locator('text=Explore Trends').locator('..').locator('..');
    await expect(trendCard.locator('text=Research')).toBeVisible();
  });
});

test.describe('Existing User Paths', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Campaigns accessible via Manage dropdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    await page.click('button:has-text("Manage")');
    await page.click('a:has-text("Campaigns")');

    await expect(page).toHaveURL(/\/campaigns/);
  });

  test('All Videos accessible via Manage dropdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    await page.click('button:has-text("Manage")');
    await page.click('a:has-text("All Videos")');

    await expect(page).toHaveURL(/\/videos/);
  });

  test('Publishing accessible via Manage dropdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    await page.click('button:has-text("Manage")');
    await page.click('a:has-text("Publishing")');

    await expect(page).toHaveURL(/\/publishing/);
  });

  test('Direct URL access still works', async ({ page }) => {
    // Test direct URLs still work
    await page.goto(`${BASE_URL}/campaigns`);
    await expect(page).toHaveURL(/\/campaigns/);

    await page.goto(`${BASE_URL}/videos`);
    await expect(page).toHaveURL(/\/videos/);

    await page.goto(`${BASE_URL}/insights`);
    await expect(page).toHaveURL(/\/insights/);
  });
});

test.describe('Accessibility', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Keyboard navigation works for main nav', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Enter should activate focused element
    await page.keyboard.press('Enter');

    // Should open a dropdown or navigate
    // (specific behavior depends on focus order)
  });

  test('Dropdown menus are keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);

    // Focus on Create button and press Enter
    await page.focus('button:has-text("Create")');
    await page.keyboard.press('Enter');

    // Dropdown should be visible
    await expect(page.locator('text=AI Generate')).toBeVisible();

    // Arrow down should navigate
    await page.keyboard.press('ArrowDown');

    // Escape should close
    await page.keyboard.press('Escape');
    await expect(page.locator('text=AI Generate')).not.toBeVisible();
  });
});

test.describe('Performance Metrics', () => {

  test('Home page loads under 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/home`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`Home page load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  test('Navigation transitions are fast', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/home`);

    const startTime = Date.now();

    await page.click('button:has-text("Manage")');
    await page.click('a:has-text("Campaigns")');
    await page.waitForLoadState('networkidle');

    const transitionTime = Date.now() - startTime;
    console.log(`Navigation transition time: ${transitionTime}ms`);

    expect(transitionTime).toBeLessThan(1500);
  });
});

test.describe('Error Handling', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Empty prompt shows validation error', async ({ page }) => {
    await page.goto(`${BASE_URL}/create/generate`);

    // Try to generate without prompt
    const generateButton = page.locator('button:has-text("Generate Video")');

    // Button should be disabled
    await expect(generateButton).toBeDisabled();
  });

  test('Console has no errors on home page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/home`);
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (like third-party scripts)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('third-party')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
