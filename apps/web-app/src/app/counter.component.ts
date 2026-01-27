import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

@Component({
  selector: 'app-counter',
  imports: [],
  template: `
    <div class="counter-container">
      <h2>Counter Example - Signal-based State</h2>
      
      <div class="demo-section">
        <div class="counter-display">
          <div class="count-value">{{ count() }}</div>
          <div class="count-label">Current Count</div>
        </div>

        <div class="counter-controls">
          <button 
            class="btn btn-primary" 
            (click)="increment()"
            aria-label="Increment counter">
            Increment (+1)
          </button>
          <button 
            class="btn btn-secondary" 
            (click)="decrement()"
            aria-label="Decrement counter">
            Decrement (-1)
          </button>
          <button 
            class="btn btn-outline" 
            (click)="reset()"
            aria-label="Reset counter">
            Reset
          </button>
        </div>

        <div class="computed-values">
          <div class="info-card">
            <span class="label">Doubled:</span>
            <span class="value">{{ doubled() }}</span>
          </div>
          <div class="info-card">
            <span class="label">Is Even:</span>
            <span class="value">{{ isEven() ? 'Yes' : 'No' }}</span>
          </div>
          <div class="info-card">
            <span class="label">Is Positive:</span>
            <span class="value">{{ isPositive() ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>

      <div class="code-explanation">
        <h3>How it works</h3>
        <p>This counter uses Angular Signals for reactive state management:</p>
        <ul>
          <li><code>count = signal(0)</code> - Writable signal for the counter value</li>
          <li><code>doubled = computed(() => count() * 2)</code> - Computed signal that auto-updates</li>
          <li><code>isEven = computed(() => count() % 2 === 0)</code> - Derived boolean state</li>
          <li>All computed values update automatically when count changes</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .counter-container {
      max-width: 700px;
      margin: 0 auto;
    }

    h2 {
      color: #1976d2;
      margin-bottom: 2rem;
    }

    .demo-section {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .counter-display {
      text-align: center;
      margin-bottom: 2rem;

      .count-value {
        font-size: 4rem;
        font-weight: 700;
        color: #1976d2;
        line-height: 1;
      }

      .count-label {
        color: #666;
        margin-top: 0.5rem;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
    }

    .counter-controls {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .btn-primary {
      background: #1976d2;
      color: white;

      &:hover {
        background: #1565c0;
      }
    }

    .btn-secondary {
      background: #dc004e;
      color: white;

      &:hover {
        background: #c51162;
      }
    }

    .btn-outline {
      background: white;
      color: #666;
      border: 2px solid #e0e0e0;

      &:hover {
        border-color: #bdbdbd;
        background: #f5f5f5;
      }
    }

    .computed-values {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      padding-top: 2rem;
      border-top: 1px solid #e0e0e0;
    }

    .info-card {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;

      .label {
        display: block;
        color: #666;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
      }

      .value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: #1976d2;
      }
    }

    .code-explanation {
      margin-top: 3rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 8px;

      h3 {
        color: #333;
        margin-bottom: 1rem;
      }

      p {
        color: #555;
        margin-bottom: 1rem;
      }

      ul {
        list-style-position: inside;

        li {
          margin: 0.5rem 0;
          color: #555;

          code {
            background: #e3f2fd;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 0.9rem;
            color: #1976d2;
          }
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CounterComponent {
  // Writable signal - the source of truth
  protected readonly count = signal(0);

  // Computed signals - automatically derived from count
  protected readonly doubled = computed(() => this.count() * 2);
  protected readonly isEven = computed(() => this.count() % 2 === 0);
  protected readonly isPositive = computed(() => this.count() > 0);

  protected increment(): void {
    this.count.update(value => value + 1);
  }

  protected decrement(): void {
    this.count.update(value => value - 1);
  }

  protected reset(): void {
    this.count.set(0);
  }
}
