import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { IonModal, provideIonicAngular } from '@ionic/angular/standalone';
import { appRoutes } from './app.routes';

it('the real page guard awaits trading dismissal before route destruction', async () => {
  const { FiMobilePage } = await import('@fi/mobile/fi-mobile.page');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'exit', children: [] }, ...appRoutes]),
      provideIonicAngular({ animated: false }),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/fi/LUMA', FiMobilePage);
  await harness.fixture.whenStable();
  harness.detectChanges();
  const trigger =
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.invest');
  if (!trigger) throw new Error('Missing Invest');
  await vi.waitFor(() => expect(trigger.disabled).toBe(false));
  const modal = harness.routeDebugElement?.query(By.directive(IonModal))
    .componentInstance as IonModal;
  vi.spyOn(modal, 'present').mockResolvedValue();
  let release = () => {
    /* controlled external cleanup boundary */
  };
  const dismiss = vi.spyOn(modal, 'dismiss').mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = () => {
          harness.routeNativeElement
            ?.querySelector('ion-modal')
            ?.dispatchEvent(new CustomEvent('didDismiss'));
          resolve(true);
        };
      }),
  );
  trigger.click();
  harness.detectChanges();
  const navigation = harness.navigateByUrl('/exit');
  await vi.waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  expect(harness.routeNativeElement?.tagName).toBe('APP-FI-MOBILE');
  release();
  await navigation;
  expect(harness.routeNativeElement).toBeNull();
});
