// Template: Data-access service
// Owns API calls, transport models, and mapping to domain models.
// Store orchestrates when/why; data-access only handles HTTP transport.

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** API response shape (transport model) */
export interface DomainApiResponse {
  id: string;
  // ... raw API fields
}

/** Domain model (what the store uses) */
export interface DomainEntity {
  id: string;
  // ... domain fields
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DomainDataAccess {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/domain';

  /**
   * Load entities by scope.
   * Maps API response to domain model.
   */
  load(scopeId: string): Observable<DomainEntity[]> {
    return this.http
      .get<DomainApiResponse[]>(`${this.baseUrl}/${encodeURIComponent(scopeId)}`)
      .pipe(
        map((response) => response.map(this.toDomainEntity)),
        catchError(this.handleError)
      );
  }

  /**
   * Get single entity by ID.
   */
  getById(id: string): Observable<DomainEntity> {
    return this.http.get<DomainApiResponse>(`${this.baseUrl}/item/${encodeURIComponent(id)}`).pipe(
      map(this.toDomainEntity),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new entity.
   */
  create(entity: Omit<DomainEntity, 'id'>): Observable<DomainEntity> {
    return this.http.post<DomainApiResponse>(this.baseUrl, entity).pipe(
      map(this.toDomainEntity),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing entity.
   */
  update(id: string, changes: Partial<DomainEntity>): Observable<DomainEntity> {
    return this.http.patch<DomainApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, changes).pipe(
      map(this.toDomainEntity),
      catchError(this.handleError)
    );
  }

  /**
   * Delete an entity.
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`).pipe(
      catchError(this.handleError)
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  /** Map API response to domain model */
  private toDomainEntity(response: DomainApiResponse): DomainEntity {
    return {
      id: response.id,
      // Map other fields as needed
    };
  }

  /** Normalize HTTP errors */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';

    if (error.status === 0) {
      message = 'Network error. Please check your connection.';
    } else if (error.status === 401) {
      message = 'Unauthorized. Please log in again.';
    } else if (error.status === 403) {
      message = 'Access denied.';
    } else if (error.status === 404) {
      message = 'Resource not found.';
    } else if (error.status >= 500) {
      message = 'Server error. Please try again later.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => new Error(message));
  }
}