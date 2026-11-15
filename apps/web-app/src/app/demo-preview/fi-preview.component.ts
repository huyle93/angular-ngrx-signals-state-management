import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { PreviewFrameComponent } from './preview-frame.component';

type PreviewMode = 'desktop' | 'mobile-web' | 'ionic';

@Component({
  selector: 'app-fi-preview',
  standalone: true,
  imports: [PreviewFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="preview-demo" aria-labelledby="preview-title">
      <div class="intro">
        <p class="eyebrow">ADAPTIVE FI · PLAYGROUND</p>
        <h2 id="preview-title">One capability. Try each experience.</h2>
        <p>Compare the responsive web page with the Ionic mobile reference.</p>
      </div>

      <div class="controls">
        <div class="modes" role="group" aria-label="Preview experience">
          <button
            type="button"
            [attr.aria-pressed]="mode() === 'desktop'"
            (click)="mode.set('desktop')"
          >
            Desktop web
          </button>
          <button
            type="button"
            [attr.aria-pressed]="mode() === 'mobile-web'"
            (click)="mode.set('mobile-web')"
          >
            Mobile web
          </button>
          <button
            type="button"
            [attr.aria-pressed]="mode() === 'ionic'"
            (click)="mode.set('ionic')"
          >
            Ionic mobile
          </button>
        </div>
        @if (mode() !== 'desktop') {
          <label
            >Phone width
            <select [value]="phoneWidth()" (change)="setWidth($event)">
              <option value="320">320px · narrow</option>
              <option value="390">390px · standard</option>
            </select>
          </label>
        }
        <button type="button" (click)="revision.update(nextRevision)">
          Reload preview
        </button>
        <a
          [href]="standaloneUrl()"
          target="_blank"
          rel="noopener"
          aria-label="Open LUMA standalone (opens in a new tab)"
          >Open LUMA standalone ↗</a
        >
      </div>

      <p class="mode-note" role="status">
        @if (mode() === 'ionic') {
          Ionic mobile app · its own header, scroll region and Invest panel.
        } @else {
          Responsive web app · switch desktop and mobile widths without
          resetting your chart or draft. Desktop uses the available width; widen
          the browser to see two columns.
        }
      </p>
      @if (mode() === 'ionic') {
        <aside class="server-help">
          <strong>Ionic preview needs the mobile server on port 4300.</strong>
          <p>
            If the frame is blank or cannot connect, run
            <code>npx nx serve mobile-reference</code>, then Reload preview.
          </p>
          <p>
            Start both apps together with
            <code>npx nx run web-app:serve-fi-demo</code>.
          </p>
        </aside>
      }
      <app-preview-frame
        [phone]="mode() !== 'desktop'"
        [width]="phoneWidth()"
        [height]="800"
      >
        <iframe
          [src]="frameUrl()"
          [title]="
            mode() === 'ionic'
              ? 'Ionic mobile FI preview'
              : 'Responsive web FI preview'
          "
        ></iframe>
      </app-preview-frame>
      <p class="limits">
        Each app owns its own session. Switching to or from Ionic, or reloading,
        starts a fresh preview. A phone frame checks browser layout; use a real
        device for native behavior.
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .intro {
        margin-bottom: 20px;
      }
      .eyebrow {
        color: #46637c;
        font-size: 12px;
        letter-spacing: 0.12em;
      }
      h2 {
        margin-block: 8px;
        font-size: clamp(22px, 3vw, 30px);
        color: #16324a;
      }
      p {
        line-height: 1.6;
        color: #41566a;
      }
      .controls,
      .modes {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      .controls {
        padding: 16px;
        background: #f1f5f9;
        border: 1px solid #c6cdd5;
        border-radius: 12px;
      }
      button,
      select {
        min-height: 44px;
        padding: 8px 12px;
        border: 1px solid #9baebf;
        border-radius: 6px;
        background: #fff;
        color: #16324a;
        font: inherit;
      }
      button {
        cursor: pointer;
      }
      button[aria-pressed='true'] {
        background: #163f63;
        border-color: #163f63;
        color: #fff;
      }
      label {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      a {
        color: #124f82;
        padding: 10px 0;
      }
      button:focus-visible,
      select:focus-visible,
      a:focus-visible {
        outline: 3px solid #a3420a;
        outline-offset: 3px;
      }
      .mode-note {
        margin-block: 16px 0;
      }
      .server-help {
        padding: 12px 16px;
        margin-top: 16px;
        background: #fff9e9;
        color: #503d12;
        border: 1px solid #e1cd99;
        border-radius: 8px;
      }
      .server-help p {
        margin: 8px 0 0;
        color: inherit;
      }
      code {
        overflow-wrap: anywhere;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        border: 0;
        flex: 1;
        background: #fff;
      }
      .limits {
        font-size: 14px;
        margin: 0 12px;
      }
    `,
  ],
})
export class FiPreviewComponent {
  protected readonly mode = signal<PreviewMode>('desktop');
  protected readonly phoneWidth = signal(390);
  protected readonly revision = signal(0);
  protected readonly nextRevision = (value: number) => value + 1;
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ionic = computed(() => this.mode() === 'ionic');
  protected readonly standaloneUrl = computed(() => {
    // The only resource targets are our FI route and the same host's mobile
    // dev server. No user-supplied URL enters the trusted iframe binding.
    const url = new URL('/fi/LUMA', this.document.location.origin);
    if (this.ionic()) url.port = '4300';
    return url.href;
  });
  protected readonly frameUrl = computed(() => {
    const url = new URL(this.standaloneUrl());
    url.searchParams.set('previewRevision', String(this.revision()));
    return this.sanitizer.bypassSecurityTrustResourceUrl(url.href);
  });
  protected setWidth(event: Event) {
    this.phoneWidth.set(
      (event.target as HTMLSelectElement).value === '320' ? 320 : 390,
    );
  }
}
