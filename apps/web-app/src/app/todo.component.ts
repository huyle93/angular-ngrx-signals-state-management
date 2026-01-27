import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

@Component({
  selector: 'app-todo',
  imports: [],
  template: `
    <div class="todo-container">
      <h2>Todo List - Signal State Management</h2>
      
      <div class="todo-input">
        <input 
          type="text" 
          [value]="newTodoText()"
          (input)="newTodoText.set($any($event.target).value)"
          (keyup.enter)="addTodo()"
          placeholder="What needs to be done?"
          aria-label="New todo text"
        />
        <button 
          class="btn btn-primary" 
          (click)="addTodo()"
          [disabled]="!newTodoText().trim()"
          aria-label="Add todo">
          Add Todo
        </button>
      </div>

      <div class="todo-stats">
        <div class="stat">
          <span class="stat-value">{{ totalCount() }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ activeCount() }}</span>
          <span class="stat-label">Active</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ completedCount() }}</span>
          <span class="stat-label">Completed</span>
        </div>
      </div>

      <div class="todo-filters">
        <button 
          class="filter-btn"
          [class.active]="filter() === 'all'"
          (click)="filter.set('all')">
          All
        </button>
        <button 
          class="filter-btn"
          [class.active]="filter() === 'active'"
          (click)="filter.set('active')">
          Active
        </button>
        <button 
          class="filter-btn"
          [class.active]="filter() === 'completed'"
          (click)="filter.set('completed')">
          Completed
        </button>
      </div>

      <div class="todo-list">
        @if (filteredTodos().length === 0) {
          <div class="empty-state">
            <p>{{ getEmptyMessage() }}</p>
          </div>
        } @else {
          @for (todo of filteredTodos(); track todo.id) {
            <div class="todo-item" [class.completed]="todo.completed">
              <input 
                type="checkbox" 
                [checked]="todo.completed"
                (change)="toggleTodo(todo.id)"
                [id]="'todo-' + todo.id"
              />
              <label [for]="'todo-' + todo.id" class="todo-text">
                {{ todo.text }}
              </label>
              <button 
                class="btn-delete" 
                (click)="deleteTodo(todo.id)"
                aria-label="Delete todo">
                ✕
              </button>
            </div>
          }
        }
      </div>

      @if (completedCount() > 0) {
        <div class="todo-actions">
          <button 
            class="btn btn-outline" 
            (click)="clearCompleted()">
            Clear Completed
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .todo-container {
      max-width: 700px;
      margin: 0 auto;
    }

    h2 {
      color: #1976d2;
      margin-bottom: 2rem;
    }

    .todo-input {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;

      input {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 6px;
        font-size: 1rem;

        &:focus {
          outline: none;
          border-color: #1976d2;
        }
      }
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background: #1976d2;
      color: white;

      &:hover:not(:disabled) {
        background: #1565c0;
      }
    }

    .btn-outline {
      background: white;
      color: #dc004e;
      border: 2px solid #dc004e;

      &:hover {
        background: #dc004e;
        color: white;
      }
    }

    .todo-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      text-align: center;

      .stat-value {
        display: block;
        font-size: 2rem;
        font-weight: 700;
        color: #1976d2;
      }

      .stat-label {
        display: block;
        color: #666;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 0.25rem;
      }
    }

    .todo-filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      justify-content: center;
    }

    .filter-btn {
      padding: 0.5rem 1rem;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      color: #666;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #1976d2;
        color: #1976d2;
      }

      &.active {
        background: #1976d2;
        border-color: #1976d2;
        color: white;
      }
    }

    .todo-list {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .todo-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-bottom: 1px solid #e0e0e0;
      transition: background-color 0.2s;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: #f8f9fa;
      }

      &.completed {
        .todo-text {
          text-decoration: line-through;
          opacity: 0.6;
        }
      }

      input[type="checkbox"] {
        width: 20px;
        height: 20px;
        cursor: pointer;
      }

      .todo-text {
        flex: 1;
        cursor: pointer;
        color: #333;
      }

      .btn-delete {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: #dc004e;
        font-size: 1.25rem;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
          background: #dc004e;
          color: white;
        }
      }
    }

    .empty-state {
      padding: 3rem;
      text-align: center;
      color: #999;
    }

    .todo-actions {
      margin-top: 1.5rem;
      text-align: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoComponent {
  // State signals
  protected readonly todos = signal<Todo[]>([]);
  protected readonly newTodoText = signal('');
  protected readonly filter = signal<'all' | 'active' | 'completed'>('all');

  private nextId = 1;

  // Computed signals
  protected readonly totalCount = computed(() => this.todos().length);
  protected readonly activeCount = computed(() => 
    this.todos().filter(todo => !todo.completed).length
  );
  protected readonly completedCount = computed(() => 
    this.todos().filter(todo => todo.completed).length
  );

  protected readonly filteredTodos = computed(() => {
    const allTodos = this.todos();
    const currentFilter = this.filter();

    switch (currentFilter) {
      case 'active':
        return allTodos.filter(todo => !todo.completed);
      case 'completed':
        return allTodos.filter(todo => todo.completed);
      default:
        return allTodos;
    }
  });

  protected addTodo(): void {
    const text = this.newTodoText().trim();
    if (!text) return;

    const newTodo: Todo = {
      id: this.nextId++,
      text,
      completed: false,
      createdAt: new Date(),
    };

    this.todos.update(todos => [...todos, newTodo]);
    this.newTodoText.set('');
  }

  protected toggleTodo(id: number): void {
    this.todos.update(todos =>
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  protected deleteTodo(id: number): void {
    this.todos.update(todos => todos.filter(todo => todo.id !== id));
  }

  protected clearCompleted(): void {
    this.todos.update(todos => todos.filter(todo => !todo.completed));
  }

  protected getEmptyMessage(): string {
    const currentFilter = this.filter();
    if (currentFilter === 'active') return 'No active todos';
    if (currentFilter === 'completed') return 'No completed todos';
    return 'No todos yet. Add one above!';
  }
}
