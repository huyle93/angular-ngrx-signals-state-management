import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-demo-shell',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoShellComponent {
  protected readonly title = 'Angular NgRx Signals State Management';
}
