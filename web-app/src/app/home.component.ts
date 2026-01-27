import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

@Component({
  selector: 'app-home',
  imports: [],
  template: `
    <div class="home-container">
      <h2>Welcome to Angular State Management Demo</h2>
      
      <section class="intro">
        <p>This application demonstrates various state management patterns in Angular using:</p>
        <ul>
          <li><strong>Signals</strong> - Angular's built-in reactivity system</li>
          <li><strong>NgRx Store</strong> - Redux-inspired state management (coming soon)</li>
          <li><strong>Component Store</strong> - Local component state (coming soon)</li>
        </ul>
      </section>

      <section class="examples">
        <h3>Available Examples</h3>
        <div class="example-cards">
          <div class="card">
            <h4>Counter (Signals)</h4>
            <p>Basic signal-based state management with computed values</p>
            <a href="/counter" class="btn">View Example →</a>
          </div>
          
          <div class="card">
            <h4>Todo List (State)</h4>
            <p>Complex state management with CRUD operations</p>
            <a href="/todo" class="btn">View Example →</a>
          </div>
        </div>
      </section>

      <section class="tech-stack">
        <h3>Technology Stack</h3>
        <div class="tech-list">
          <span class="tech-badge">Angular {{ angularVersion() }}</span>
          <span class="tech-badge">TypeScript {{ typescriptVersion() }}</span>
          <span class="tech-badge">Nx {{ nxVersion() }}</span>
          <span class="tech-badge">Signals</span>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-container {
      max-width: 900px;
      margin: 0 auto;
    }

    h2 {
      color: #1976d2;
      margin-bottom: 2rem;
      font-size: 2rem;
    }

    .intro {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;

      p {
        margin-bottom: 1rem;
      }

      ul {
        list-style-position: inside;
        
        li {
          margin: 0.5rem 0;
          color: #555;
        }
      }
    }

    .examples {
      margin: 3rem 0;

      h3 {
        margin-bottom: 1.5rem;
        color: #333;
      }
    }

    .example-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      transition: box-shadow 0.2s, transform 0.2s;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }

      h4 {
        color: #1976d2;
        margin-bottom: 0.75rem;
      }

      p {
        color: #666;
        margin-bottom: 1rem;
        font-size: 0.9rem;
      }

      .btn {
        display: inline-block;
        color: #1976d2;
        text-decoration: none;
        font-weight: 600;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }

    .tech-stack {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #e0e0e0;

      h3 {
        margin-bottom: 1rem;
        color: #333;
      }
    }

    .tech-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .tech-badge {
      background: #e3f2fd;
      color: #1976d2;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly angularVersion = signal('21.x');
  protected readonly typescriptVersion = signal('5.9.3');
  protected readonly nxVersion = signal('22.4.2');
}
