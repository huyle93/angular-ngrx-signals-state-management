import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { appRoutes } from './app.routes';

it('waits for the mobile page to release its overlay before route destruction', async () => {
  const { FiMobilePage } = await import('@fi/mobile/fi-mobile.page');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'exit', children: [] }, ...appRoutes]),
      provideIonicAngular({ animated: false }),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/fi/LUMA', FiMobilePage);
  let released = false;
  let release = () => {
    /* assigned by the pending lifecycle below */
  };
  const leaving = vi.spyOn(page, 'canLeave').mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = () => {
          released = true;
          resolve(true);
        };
      }),
  );
  const navigation = harness.navigateByUrl('/exit');
  await vi.waitFor(() => expect(leaving).toHaveBeenCalledOnce());
  expect(released).toBe(false);
  expect(harness.routeNativeElement?.tagName).toBe('APP-FI-MOBILE');
  release();
  await navigation;
  expect(harness.routeNativeElement).toBeNull();
});
