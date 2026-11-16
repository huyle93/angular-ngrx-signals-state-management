import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonModal, provideIonicAngular } from '@ionic/angular/standalone';
import { MobileTradeComponent } from './mobile-trade.component';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup() {
  TestBed.configureTestingModule({
    providers: [provideIonicAngular({ animated: false })],
  });
  const fixture = TestBed.createComponent(MobileTradeComponent);
  fixture.componentRef.setInput('symbol', 'LUMA');
  fixture.componentRef.setInput('price', 85);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const element = <T extends Element>(selector: string): T => {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error('Missing ' + selector);
    return found;
  };
  const modal = fixture.debugElement.query(By.directive(IonModal))
    .componentInstance as IonModal;
  const emit = (name: string) =>
    element('ion-modal').dispatchEvent(new CustomEvent(name));
  // Control the external overlay promises/events. Real overlay DOM/focus is tested in browser smoke.
  const present = vi.spyOn(modal, 'present').mockImplementation(async () => {
    emit('ionMount');
    emit('didPresent');
  });
  const dismiss = vi.spyOn(modal, 'dismiss').mockImplementation(async () => {
    emit('didDismiss');
    return true;
  });
  const open = async () => {
    await fixture.componentInstance['open']();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, element, present, dismiss, emit, open };
}

describe('Mobile trading lifecycle coordination', () => {
  it('accepts one open and awaits presentation before dismissing, even after repeated taps', async () => {
    const { fixture, element, present, dismiss } = await setup();
    const entering = deferred<void>();
    present.mockReturnValue(entering.promise);
    element<HTMLButtonElement>('.invest').click();
    element<HTMLButtonElement>('.invest').click();
    element<HTMLButtonElement>('.invest').click();
    expect(present).toHaveBeenCalledOnce();
    const leaving = fixture.componentInstance.dismiss(false);
    await Promise.resolve();
    expect(dismiss).not.toHaveBeenCalled();
    entering.resolve();
    await leaving;
    expect(dismiss).toHaveBeenCalledOnce();
  });
  it('destroys the inner form on close but preserves raw input on reopen and quote recovery', async () => {
    const { fixture, element, open, dismiss } = await setup();
    await open();
    const input = element<HTMLInputElement>('input');
    input.value = '42.';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.componentInstance.dismiss(false);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-order-entry'),
    ).toBeNull();
    await open();
    expect(element<HTMLInputElement>('input').value).toBe('42.');
    fixture.componentRef.setInput('price', null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dismiss).toHaveBeenCalledTimes(2);
    await fixture.componentInstance.dismiss(false);
    expect(element<HTMLButtonElement>('.invest').disabled).toBe(true);
    fixture.componentRef.setInput('price', 86);
    fixture.detectChanges();
    await open();
    expect(element<HTMLInputElement>('input').value).toBe('42.');
    await fixture.componentInstance.dismiss(false);
  });
  it.each([true, false])(
    'awaits cleanup and only reopens after a user close (restoreFocus=%s)',
    async (restoreFocus) => {
      const { fixture, present, dismiss, emit, open } = await setup();
      await open();
      const cleanup = deferred<boolean>();
      dismiss.mockImplementation(() => {
        emit('didDismiss');
        return cleanup.promise;
      });
      const closing = fixture.componentInstance.dismiss(restoreFocus);
      await vi.waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
      fixture.detectChanges();
      const reopening = fixture.componentInstance['open']();
      await Promise.resolve();
      expect(present).toHaveBeenCalledOnce();
      cleanup.resolve(true);
      await closing;
      await reopening;
      await fixture.whenStable();
      expect(present).toHaveBeenCalledTimes(restoreFocus ? 2 : 1);
      dismiss.mockImplementation(async () => {
        emit('didDismiss');
        return true;
      });
      await fixture.componentInstance.dismiss(false);
    },
  );
  it('recovers the trigger and permits route cleanup when presentation rejects', async () => {
    const { fixture, present, dismiss, open, element } = await setup();
    present.mockRejectedValueOnce(new Error('presentation failed'));
    await open();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(element<HTMLButtonElement>('.invest').disabled).toBe(false);
    expect(element('[role=status]').textContent).toContain('Try Invest again');
    await fixture.componentInstance.dismiss(false);
    await open();
    expect(present).toHaveBeenCalledTimes(2);
    await fixture.componentInstance.dismiss(false);
  });
});
