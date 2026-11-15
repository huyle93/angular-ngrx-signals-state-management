// Run with the Playwright CLI's run-code command after opening the local web app.
// This is a browser evidence script, not an @playwright/test suite.
async (page) => {
  page.setDefaultTimeout(10000);
  const results = [];
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const ready = () =>
    page
      .getByRole('heading', { name: 'Luma Orchard Labs', exact: true })
      .waitFor();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:4200/fi/LUMA');
  await ready();
  await page.getByRole('button', { name: '3M', exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-pressed=true]')
        ?.textContent.trim() === '3M',
  );
  await page.getByRole('textbox', { name: 'Amount in USD' }).fill('125.');
  await page.evaluate(() => {
    window.a3Chart = document.querySelector('app-instrument-chart');
    window.a3Ticket = document.querySelector('app-demo-trade');
  });
  for (const width of [1440, 768, 320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const value = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      columns: getComputedStyle(document.querySelector('.fi-layout'))
        .gridTemplateColumns,
      chart: window.a3Chart === document.querySelector('app-instrument-chart'),
      ticket: window.a3Ticket === document.querySelector('app-demo-trade'),
      charts: document.querySelectorAll('app-instrument-chart').length,
      tickets: document.querySelectorAll('app-demo-trade').length,
      range: document
        .querySelector('button[aria-pressed=true]')
        .textContent.trim(),
      amount: document.querySelector('#trade-amount').value,
    }));
    check(
      value.scroll <= width &&
        value.chart &&
        value.ticket &&
        value.charts === 1 &&
        value.tickets === 1 &&
        value.range === '3M' &&
        value.amount === '125.',
      'Resize continuity/overflow: ' + JSON.stringify(value),
    );
    check(
      value.columns.split(' ').length === (width === 1440 ? 2 : 1),
      'Unexpected grid tracks',
    );
    results.push({ kind: 'resize', ...value });
  }
  await page.getByLabel('Demo appearance').selectOption('b');
  await page.waitForFunction(
    () => document.documentElement.dataset.demoBrand === 'b',
  );
  check(
    (await page
      .getByRole('textbox', { name: 'Amount in USD' })
      .inputValue()) === '125.',
    'Theme reset draft',
  );
  check(
    (await page
      .getByRole('button', { name: '3M', exact: true })
      .getAttribute('aria-pressed')) === 'true',
    'Theme reset range',
  );
  for (const brand of ['a', 'b']) {
    await page.getByLabel('Demo appearance').selectOption(brand);
    const contrast = await page.evaluate(() => {
      const css = getComputedStyle(document.querySelector('.fi-theme'));
      const rgb = (key) =>
        css
          .getPropertyValue(key)
          .trim()
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
      const lum = (key) =>
        rgb(key).reduce(
          (sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i],
          0,
        );
      const ratio = (a, b) =>
        (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      return {
        text: ratio('--fi-text', '--fi-bg'),
        muted: ratio('--fi-muted', '--fi-bg'),
        action: ratio('--fi-on-action', '--fi-action'),
        focus: ratio('--fi-focus', '--fi-surface'),
        error: ratio('--fi-error', '--fi-surface'),
      };
    });
    check(
      Object.entries(contrast).every(
        ([key, value]) => value >= (key === 'focus' ? 3 : 4.5),
      ),
      'Contrast failure',
    );
    results.push({ kind: 'contrast', brand, ...contrast });
    await page.screenshot({
      path: `output/playwright/a3/web-wide-${brand}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({
    path: 'output/playwright/a3/web-320-b.png',
    fullPage: true,
  });
  await page.getByRole('textbox', { name: 'Amount in USD' }).fill('125.50');
  await page.getByRole('button', { name: 'Preview demo amount' }).click();
  await page.getByText('No order was placed.', { exact: false }).waitFor();
  await page.getByText('Explore data states', { exact: true }).click();
  for (const [button, heading] of [
    ['Empty', 'No instrument data'],
    ['Error', 'Unable to load this idea'],
  ]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByRole('heading', { name: heading }).waitFor();
    check(
      (await page.locator('app-instrument-chart').count()) === 0,
      'Unavailable data rendered as current',
    );
    await page.getByRole('button', { name: 'Try again' }).focus();
    await page.keyboard.press('Enter');
    await ready();
    check(
      (await page
        .getByRole('textbox', { name: 'Amount in USD' })
        .inputValue()) === '125.50',
      'Same-symbol web retry lost draft',
    );
    check(
      await page.evaluate(
        () =>
          document.activeElement?.getAttribute('aria-label') ===
          'Instrument status',
      ),
      'Retry lost keyboard focus',
    );
  }
  await page.getByRole('button', { name: 'Slow loading' }).click();
  await page.getByText('Loading synthetic instrument…').waitFor();
  await page.getByRole('link', { name: 'TIDE', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Tidepaper Works', exact: true })
    .waitFor();
  await page.waitForTimeout(2300);
  check(
    (await page
      .getByRole('heading', { name: 'Tidepaper Works', exact: true })
      .count()) === 1,
    'Stale symbol won',
  );
  check(
    (await page
      .getByRole('textbox', { name: 'Amount in USD' })
      .inputValue()) === '',
    'Symbol carried old draft',
  );
  await page.goBack();
  await ready();
  await page.reload();
  await ready();
  await page.goto('http://localhost:4200/fi/UNKNOWN');
  await page.getByRole('heading', { name: 'No instrument data' }).waitFor();
  results.push({
    kind: 'web',
    themeContinuity: true,
    preview: true,
    emptyErrorRetry: true,
    retryFocus: true,
    staleCancellation: true,
    backReload: true,
    unknownSymbol: true,
  });
  for (const [route, text] of [
    ['/', 'Welcome'],
    ['/counter', 'Counter'],
    ['/todo', 'Todo'],
    ['/ticker', 'Price Ticker Odometer Demo'],
    ['/trade-entry', 'Stock Detail'],
  ]) {
    await page.goto('http://localhost:4200' + route);
    await page.getByText(text, { exact: false }).first().waitFor();
    results.push({ kind: 'preserved-route', route });
  }
  await page.goto('http://localhost:4300/fi/LUMA?brand=b');
  await ready();
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    (await page.getByLabel('Demo appearance').inputValue()) === 'b',
    'Startup appearance',
  );
  await page.getByRole('button', { name: '3M', exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-pressed=true]')
        ?.textContent.trim() === '3M',
  );
  await page.getByText('Explore data states', { exact: true }).click();
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Unable to load this idea' })
    .waitFor();
  await page.getByRole('button', { name: 'Try again' }).focus();
  await page.keyboard.press('Enter');
  await ready();
  check(
    await page.evaluate(
      () =>
        document.activeElement?.getAttribute('aria-label') ===
        'Instrument status',
    ),
    'Mobile retry lost focus',
  );
  await page.getByText('Explore data states', { exact: true }).click();
  const invest = page.getByRole('button', {
    name: 'Invest (demo)',
    exact: true,
  });
  await invest.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.activeElement?.id === 'trade-amount',
  );
  await page.getByRole('textbox', { name: 'Amount in USD' }).fill('42.');
  await page.getByRole('button', { name: 'Close demo order entry' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains('invest'),
  );
  check(
    await invest.evaluate((el) => el === document.activeElement),
    'Focus did not return to Invest',
  );
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Amount in USD' }).waitFor();
  await page.waitForFunction(
    () => document.activeElement?.id === 'trade-amount',
  );
  check(
    (await page
      .getByRole('textbox', { name: 'Amount in USD' })
      .inputValue()) === '42.',
    'Modal lost draft',
  );
  await page.screenshot({ path: 'output/playwright/a3/mobile-panel-b.png' });
  await page.setViewportSize({ width: 320, height: 900 });
  const mobile = await page.evaluate(() => {
    const content = document.querySelector('ion-modal ion-content');
    const scroll = content.shadowRoot.querySelector('.inner-scroll');
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      contentWidth: scroll.clientWidth,
      scrollWidth: scroll.scrollWidth,
      bodyScroll: document.documentElement.scrollHeight > innerHeight,
      scrollOwner: scroll.scrollHeight > scroll.clientHeight,
      charts: document.querySelectorAll('app-instrument-chart').length,
      tickets: document.querySelectorAll('app-order-entry').length,
    };
  });
  check(
    mobile.documentWidth === 320 &&
      mobile.scrollWidth === mobile.contentWidth &&
      !mobile.bodyScroll &&
      mobile.charts === 1 &&
      mobile.tickets === 1,
    'Mobile scroll/overflow: ' + JSON.stringify(mobile),
  );
  results.push({
    kind: 'mobile',
    ...mobile,
    retryFocus: true,
    keyboardOpen: true,
    focusReturn: true,
    draftContinuity: true,
  });
  await page.getByRole('button', { name: 'Close demo order entry' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('app-order-entry').length === 0,
  );
  const pageScroll = await page
    .locator('app-fi-mobile > ion-content')
    .evaluate(async (el) => {
      const scroll = await el.getScrollElement();
      return {
        scrollOwner: scroll.scrollHeight > scroll.clientHeight,
        bodyScroll: document.documentElement.scrollHeight > innerHeight,
        scrollWidth: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
      };
    });
  check(
    pageScroll.scrollOwner &&
      !pageScroll.bodyScroll &&
      pageScroll.scrollWidth === pageScroll.clientWidth,
    'Underlying Ionic page lost its scroll owner: ' +
      JSON.stringify(pageScroll),
  );
  results.push({ kind: 'mobile-page-after-dismiss', ...pageScroll });
  await page.getByLabel('Demo appearance').selectOption('a');
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('app-fi-mobile > ion-content')
    .evaluate((el) => el.scrollToTop(0));
  await page.screenshot({ path: 'output/playwright/a3/mobile-a.png' });
  await page.getByLabel('Demo appearance').selectOption('b');
  await page.waitForFunction(
    () => document.documentElement.dataset.demoBrand === 'b',
  );
  await page.screenshot({ path: 'output/playwright/a3/mobile-b.png' });
  await page.getByRole('link', { name: 'TIDE', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Tidepaper Works', exact: true })
    .waitFor();
  await page.goBack();
  await ready();
  check(errors.length === 0, 'Page errors: ' + errors.join('; '));
  results.push({ kind: 'runtime-errors', errors });
  return results;
};
