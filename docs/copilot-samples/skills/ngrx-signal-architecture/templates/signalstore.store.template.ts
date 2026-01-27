// Template: SignalStore (domain-owned)
// Copy into a domain store and replace: Domain, DomainEntity, state keys, selectors, methods.

import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DomainEntity {
  id: string;
  // Add domain-specific properties
}

export interface DomainState {
  // Keep state minimal and domain-owned.
  // Prefer IDs; derive objects via computed selectors.
  loadStatus: LoadStatus;
  error: string | null;
  selectedId: string | null;
  entitiesById: Record<string, DomainEntity>;
}

const initialState: DomainState = {
  loadStatus: 'idle',
  error: null,
  selectedId: null,
  entitiesById: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Access (move to separate data-access lib in real usage)
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DomainDataAccess {
  private readonly http = inject(HttpClient);

  load(scopeId: string): Observable<DomainEntity[]> {
    return this.http.get<DomainEntity[]>(`/api/domain/${encodeURIComponent(scopeId)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const DomainStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  // Destructure store properties to avoid implicit any and improve readability
  withComputed(({ loadStatus, selectedId, entitiesById }) => ({
    isLoading: computed(() => loadStatus() === 'loading'),
    hasError: computed(() => loadStatus() === 'error'),
    entities: computed(() => Object.values(entitiesById())),
    selectedEntity: computed(() => {
      const id = selectedId();
      return id ? entitiesById()[id] ?? null : null;
    }),
  })),

  withMethods((store, dataAccess = inject(DomainDataAccess)) => ({
    select(id: string | null): void {
      patchState(store, { selectedId: id });
    },

    load: rxMethod<{ scopeId: string }>(
      pipe(
        tap(() => patchState(store, { loadStatus: 'loading', error: null })),
        switchMap(({ scopeId }) =>
          dataAccess.load(scopeId).pipe(
            tapResponse({
              next: (entities) =>
                patchState(store, {
                  loadStatus: 'success',
                  entitiesById: toEntityMap(entities),
                }),
              error: (err: Error) =>
                patchState(store, {
                  loadStatus: 'error',
                  error: err.message ?? 'Unknown error',
                }),
            })
          )
        )
      )
    ),

    reset(): void {
      patchState(store, initialState);
    },
  })),

  withHooks({
    onInit(store) {
      // Optional: trigger initial load or setup
      // store.load({ scopeId: 'default' });
    },
    onDestroy() {
      // Optional: cleanup if needed
    },
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toEntityMap(entities: DomainEntity[]): Record<string, DomainEntity> {
  return entities.reduce(
    (acc, entity) => {
      acc[entity.id] = entity;
      return acc;
    },
    {} as Record<string, DomainEntity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: Using withEntities (preferred for entity collections)
// ─────────────────────────────────────────────────────────────────────────────
/*
import { withEntities, setAllEntities, removeEntity, updateEntity } from '@ngrx/signals/entities';

export const DomainStoreWithEntities = signalStore(
  { providedIn: 'root' },

  withEntities<DomainEntity>(),

  withState({
    loadStatus: 'idle' as LoadStatus,
    error: null as string | null,
    selectedId: null as string | null,
  }),

  withComputed(({ loadStatus, selectedId, entityMap }) => ({
    isLoading: computed(() => loadStatus() === 'loading'),
    selectedEntity: computed(() => {
      const id = selectedId();
      return id ? entityMap()[id] ?? null : null;
    }),
  })),

  withMethods((store, dataAccess = inject(DomainDataAccess)) => ({
    select(id: string | null): void {
      patchState(store, { selectedId: id });
    },

    load: rxMethod<{ scopeId: string }>(
      pipe(
        tap(() => patchState(store, { loadStatus: 'loading', error: null })),
        switchMap(({ scopeId }) =>
          dataAccess.load(scopeId).pipe(
            tapResponse({
              next: (entities) =>
                patchState(store, setAllEntities(entities), { loadStatus: 'success' }),
              error: (err: Error) =>
                patchState(store, { loadStatus: 'error', error: err.message }),
            })
          )
        )
      )
    ),

    remove(id: string): void {
      patchState(store, removeEntity(id));
    },

    update(id: string, changes: Partial<DomainEntity>): void {
      patchState(store, updateEntity({ id, changes }));
    },
  })),

  withHooks({
    onInit() {
      // Optional initialization
    },
  })
);
*/