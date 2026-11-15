async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:4200/');
  await page.getByRole('link', { name: 'Adaptive FI', exact: true }).click();
  await page
    .getByRole('heading', { name: 'One capability. Try each experience.' })
    .waitFor();
  const iframe = page.locator('app-fi-preview iframe');
  let child = page.frameLocator('app-fi-preview iframe');
  await child.getByRole('heading', { name: 'Luma Orchard Labs' }).waitFor();
  await child.getByRole('button', { name: '3M', exact: true }).click();
  await child.getByLabel('Amount in USD').fill('125.');
  await child
    .locator('app-instrument-chart svg')
    .evaluate((el) => (el.dataset['previewIdentity'] = 'same'));
  const originalSrc = await iframe.getAttribute('src');
  assert(
    (await child
      .locator('.fi-layout')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      )) === 2,
    'desktop missing two columns',
  );
  await page.getByRole('button', { name: 'Mobile web', exact: true }).click();
  await page.getByLabel('Phone width').selectOption('320');
  assert(
    (await iframe.getAttribute('src')) === originalSrc,
    'web mode reloaded iframe',
  );
  assert(
    (await child.getByLabel('Amount in USD').inputValue()) === '125.',
    'draft lost on preview resize',
  );
  assert(
    (await child
      .locator('app-instrument-chart svg')
      .getAttribute('data-preview-identity')) === 'same',
    'chart recreated',
  );
  assert(
    (await child
      .getByRole('button', { name: '3M', exact: true })
      .getAttribute('aria-pressed')) === 'true',
    'range lost',
  );
  const mobile = await child
    .locator('body')
    .evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
  assert(
    mobile.width === 320 && mobile.scroll === 320,
    'wrong mobile web viewport / overflow',
  );
  await page.screenshot({
    path: 'output/playwright/a3/preview-mobile-web.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Desktop web', exact: true }).click();
  assert(
    (await child.getByLabel('Amount in USD').inputValue()) === '125.',
    'draft lost on desktop return',
  );
  await page.screenshot({
    path: 'output/playwright/a3/preview-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Ionic mobile', exact: true }).click();
  await child.locator('ion-content').waitFor();
  await iframe.scrollIntoViewIfNeeded();
  await child.getByRole('heading', { name: 'Luma Orchard Labs' }).waitFor();
  assert(
    (await iframe.getAttribute('src')).startsWith(
      'http://localhost:4300/fi/LUMA',
    ),
    'not actual mobile app',
  );
  const ionic = await child.locator('ion-content').evaluate(async (el) => {
    const s = await el.getScrollElement();
    return {
      width: innerWidth,
      scrollOwner: s.scrollHeight > s.clientHeight,
      bodyScroll: document.documentElement.scrollHeight > innerHeight,
    };
  });
  assert(
    ionic.width === 320 && ionic.scrollOwner && !ionic.bodyScroll,
    'ionic scroll/viewport failed',
  );
  await iframe.scrollIntoViewIfNeeded();
  await child
    .getByRole('button', { name: 'Invest · demo', exact: true })
    .click();
  await child.getByLabel('Amount in USD').fill('42.');
  await child
    .getByRole('button', { name: 'Close demo panel', exact: true })
    .click();
  await iframe.scrollIntoViewIfNeeded();
  await child
    .getByRole('button', { name: 'Invest · demo', exact: true })
    .click();
  assert(
    (await child.getByLabel('Amount in USD').inputValue()) === '42.',
    'mobile disclosure draft lost',
  );
  await page.screenshot({
    path: 'output/playwright/a3/preview-ionic.png',
    fullPage: true,
  });
  const navigated = page.waitForEvent('framenavigated', {
    predicate: (frame) =>
      frame.url().startsWith('http://localhost:4300/fi/LUMA') &&
      frame.url().includes('previewRevision=1'),
  });
  await page
    .getByRole('button', { name: 'Reload preview', exact: true })
    .click();
  await navigated;
  await child.getByRole('heading', { name: 'Luma Orchard Labs' }).waitFor();
  assert(
    !(await child.getByLabel('Amount in USD').isVisible()) &&
      (await child.getByLabel('Amount in USD').inputValue()) === '',
    'reload did not reset ionic disclosure/draft',
  );
  await page.setViewportSize({ width: 320, height: 900 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'outer preview page overflow',
  );
  await page.goto('http://localhost:4200/trade-entry');
  await page.getByRole('button', { name: 'Invest', exact: true }).click();
  await page.getByRole('button', { name: 'Buy', exact: true }).click();
  await page
    .getByText('modal launch -> intent: buy', { exact: false })
    .waitFor();
  const legacy = await page
    .locator('app-preview-frame .viewport')
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      transform: getComputedStyle(el).transform,
    }));
  assert(
    legacy.width === 390 && legacy.height === 750,
    'legacy frame changed geometry',
  );
  assert(errors.length === 0, 'runtime errors ' + errors.join(','));
  return {
    webStateContinuity: true,
    mobile,
    ionic,
    legacy,
    outer320NoOverflow: true,
    errors,
  };
};
