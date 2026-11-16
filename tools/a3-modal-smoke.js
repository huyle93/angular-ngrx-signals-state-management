// Browser evidence, executed by the pinned Playwright CLI through Nx.
async (page) => {
  page.setDefaultTimeout(10000);
  const results = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const ready = () =>
    page
      .getByRole('heading', { name: 'Luma Orchard Labs', exact: true })
      .waitFor();
  const invest = () =>
    page.getByRole('button', { name: 'Invest (demo)', exact: true });
  const amount = () => page.getByRole('textbox', { name: 'Amount in USD' });
  const open = async () => {
    await invest().click();
    await amount().waitFor();
    await page.waitForFunction(
      () => document.activeElement?.id === 'trade-amount',
    );
  };
  const clean = async () => {
    await page.waitForFunction(
      () =>
        !document.body.classList.contains('backdrop-no-scroll') &&
        document.querySelectorAll('ion-modal.show-modal').length === 0 &&
        document.querySelectorAll('app-order-entry').length === 0,
    );
    check(
      (await page
        .locator('#ion-view-container-root')
        .getAttribute('aria-hidden')) !== 'true',
      'Background stayed hidden',
    );
  };
  await page.goto('http://localhost:4300/fi/LUMA');
  await ready();
  for (const [width, height, brand] of [
    [390, 844, 'a'],
    [320, 640, 'b'],
    [1024, 768, 'b'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel('Demo appearance').selectOption(brand);
    await open();
    await amount().fill('42.');
    const geometry = await page.locator('ion-modal').evaluate(async (el) => {
      const wrapper = el.shadowRoot.querySelector('[role=dialog]');
      const box = wrapper.getBoundingClientRect();
      const scroll = await el.querySelector('ion-content').getScrollElement();
      const css = getComputedStyle(el);
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        dialogName: wrapper.getAttribute('aria-label'),
        ariaModal: wrapper.getAttribute('aria-modal'),
        backgroundHidden: document
          .querySelector('#ion-view-container-root')
          .getAttribute('aria-hidden'),
        teleported: el.parentElement.tagName === 'ION-APP',
        bg: css.getPropertyValue('--fi-bg').trim(),
        action: css.getPropertyValue('--fi-action').trim(),
        bodyScroll: document.documentElement.scrollHeight > innerHeight,
        scrollWidth: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
        formCount: document.querySelectorAll('app-order-entry').length,
      };
    });
    check(
      Math.abs(geometry.width - width) < 1 &&
        Math.abs(geometry.height - height) < 1 &&
        geometry.x === 0 &&
        geometry.y === 0,
      'Modal not full viewport ' + JSON.stringify(geometry),
    );
    check(
      geometry.dialogName === 'Demo order entry' &&
        geometry.ariaModal === 'true' &&
        geometry.backgroundHidden === 'true' &&
        geometry.teleported &&
        geometry.formCount === 1,
      'Modal semantics/isolation ' + JSON.stringify(geometry),
    );
    check(
      geometry.scrollWidth === geometry.clientWidth && !geometry.bodyScroll,
      'Modal overflow ' + JSON.stringify(geometry),
    );
    check(
      geometry.bg === (brand === 'a' ? '#f4f6f2' : '#f3f2f8'),
      'Teleported theme lost ' + JSON.stringify(geometry),
    );
    // Scrollable containers can add a browser focus stop. Challenge the full cycle in both directions.
    const focusStops = [];
    for (const key of [
      'Tab',
      'Tab',
      'Tab',
      'Tab',
      'Shift+Tab',
      'Shift+Tab',
      'Shift+Tab',
      'Shift+Tab',
    ]) {
      await page.keyboard.press(key);
      const stop = await page.evaluate(() => ({
        inside: document
          .querySelector('ion-modal')
          .contains(document.activeElement),
        tag: document.activeElement.tagName,
        id: document.activeElement.id,
      }));
      check(stop.inside, 'Focus escaped ' + JSON.stringify(stop));
      focusStops.push(stop);
    }
    check(
      focusStops.some((stop) => stop.id === 'trade-amount') &&
        focusStops.some((stop) => stop.tag === 'BUTTON'),
      'Did not cycle form controls',
    );
    await page.keyboard.press('Escape');
    await clean();
    check(
      await invest().evaluate((el) => el === document.activeElement),
      'Escape did not restore focus',
    );
    await open();
    check((await amount().inputValue()) === '42.', 'Reopen lost partial draft');
    await page.screenshot({
      path: `output/playwright/a3/modal-${width}-${brand}.png`,
    });
    await page.getByRole('button', { name: 'Close demo order entry' }).click();
    await clean();
    results.push({
      kind: 'modal',
      brand,
      ...geometry,
      focusTrap: true,
      escape: true,
      reopenPartial: true,
    });
  }
  // Inject data changes through the existing demo scenario controls, while the overlay is active.
  await open();
  await amount().fill('125.50');
  await page.getByRole('button', { name: 'Preview demo amount' }).click();
  await page.getByText('No order was placed.', { exact: false }).waitFor();
  await page.locator('app-demo-scenarios').evaluate((el) => {
    el.querySelector('details').open = true;
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Error')
      .click();
  });
  await clean();
  await page
    .getByRole('heading', { name: 'Unable to load this idea' })
    .waitFor();
  check(await invest().isDisabled(), 'Invest enabled without quote');
  await page.getByRole('button', { name: 'Try again' }).click();
  await ready();
  await open();
  check(
    (await amount().inputValue()) === '125.50',
    'Same-symbol refresh lost draft',
  );
  check(
    (await page.locator('app-order-entry [role=status]').textContent()) === '',
    'Stale preview retained',
  );
  await page.locator('a[routerlink="/fi/TIDE"]').evaluate((el) => el.click());
  await clean();
  await page
    .getByRole('heading', { name: 'Tidepaper Works', exact: true })
    .waitFor();
  await open();
  check((await amount().inputValue()) === '', 'Symbol change kept draft');
  // Browser Back keeps its normal route navigation; it closes the modal before the next symbol is usable.
  await page.goBack();
  await clean();
  await ready();
  await open();
  check(
    (await amount().inputValue()) === '',
    'Back revived previous symbol draft',
  );
  await page.getByRole('button', { name: 'Close demo order entry' }).click();
  await clean();
  // Rapid taps, including a context change during presentation, must leave one clean overlay at most.
  await invest().evaluate((el) => {
    el.click();
    el.click();
    el.click();
  });
  await amount().waitFor();
  await page.waitForFunction(
    () => document.activeElement?.id === 'trade-amount',
  );
  check(
    (await page.locator('ion-modal.show-modal').count()) === 1,
    'Duplicate overlay',
  );
  await page.getByRole('button', { name: 'Close demo order entry' }).click();
  await clean();
  await invest().evaluate((el) => {
    el.click();
    document.querySelector('a[routerlink="/fi/TIDE"]').click();
  });
  await clean();
  await page
    .getByRole('heading', { name: 'Tidepaper Works', exact: true })
    .waitFor();
  // A componentless test destination exercises the actual app's canDeactivate guard.
  // Use Angular's dev-only debug surface; no test route or debug hook ships in the app.
  await page.evaluate(() => {
    const link = document.querySelector('a[routerlink]');
    const router = window.ng.getDirectives(link).find((d) => d.router).router;
    router.resetConfig([
      { path: 'modal-exit-check', children: [] },
      ...router.config,
    ]);
  });
  await invest().evaluate((el) => el.click());
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const link = document.querySelector('a[routerlink]');
    const router = window.ng.getDirectives(link).find((d) => d.router).router;
    await router.navigateByUrl('/modal-exit-check');
  });
  await clean();
  check(
    (await page.locator('ion-modal').count()) === 0,
    'Teleported modal survived Escape/route-exit race',
  );
  await page.goBack();
  await page
    .getByRole('heading', { name: 'Tidepaper Works', exact: true })
    .waitFor();
  await open();
  check((await amount().inputValue()) === '', 'Route exit retained session');
  await page.getByRole('button', { name: 'Close demo order entry' }).click();
  await clean();
  results.push({
    kind: 'lifecycle',
    sameSymbolRecovery: true,
    previewInvalidated: true,
    symbolReset: true,
    browserBack: true,
    rapidTaps: true,
    presentationRace: true,
    routeExitCleanup: true,
    escapeDuringPresentationThenRouteExit: true,
  });
  check(errors.length === 0, 'Runtime errors: ' + errors.join(';'));
  results.push({ kind: 'runtime-errors', errors });
  return results;
};
