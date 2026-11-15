import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular/standalone';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template:
    '<ion-app><div id="ion-view-container-root"><router-outlet /></div></ion-app>',
  styles: [
    '#ion-view-container-root { position: relative; width: 100%; height: 100%; }',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
