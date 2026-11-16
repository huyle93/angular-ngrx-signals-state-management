import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { App } from './app';
import { appRoutes } from './app.routes';
describe('Application route composition', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(appRoutes),
        provideIonicAngular({ animated: false }),
      ],
    }),
  );
  it('keeps the demo shell on legacy routes and removes it for FI navigation', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/counter');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-header')).not.toBeNull();
    await router.navigateByUrl('/fi/LUMA');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-fi-web')).not.toBeNull();
    await router.navigateByUrl('/todo');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-header')).not.toBeNull();
  });
  it('never instantiates a demo shell for a direct FI route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-header')).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/fi/TIDE');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-header')).toBeNull();
  });
});
