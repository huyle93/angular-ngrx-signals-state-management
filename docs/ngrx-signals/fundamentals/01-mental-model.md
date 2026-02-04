# Mental Model Shift

This is not a tool comparison. This is a thinking-model comparison.

---

## Redux Mental Model

> "State changes are messages."

```
UI
 \- dispatch(action)
      |- reducer(state, action) -> newState
      |- selector(state) -> viewData
      \- effect(action)
           \- async -> dispatch(successAction)
```

Core ideas:

- Actions are the API
- Reducers are pure, global state machines
- Effects orchestrate async
- State feels like a database
- Everything is event-driven

Developer habit:

- "I need to create an action type for this"
- "Where is the reducer case?"
- "How do I select this slice?"
- "Where do I put this effect?"

---

## SignalStore Mental Model

> "State is owned and mutated intentionally."

```
UI
 \- store.method()
      |- patchState()
      |- computed recalculates
      \- template updates (sync)
           \- data-access -> API
```

Core ideas:

- Methods are the API
- State is co-located with logic
- Derived state is first-class
- Async is a dependency, not the driver
- Ownership matters more than events

Developer habit:

- "Who owns this state?"
- "What is derived vs stored?"
- "Where is the single write method?"
- "What resets when session ends?"
- "Which async stays in data-access?"

---

## The Biggest Change

**Redux:** actions are the API

- The public interface is dispatching actions
- You cannot mutate state directly
- You must dispatch a message and let reducers update

**SignalStore:** methods are the API

- The public interface is calling store methods
- State changes are direct (but controlled) writes inside store methods

---

## One-Liner

> Redux is message-driven. SignalStore is method-driven.

---

## What You Stop Doing

- Creating an action for every UI interaction
- Thinking "where should this reducer live?"
- Building long effect chains
- Using the store as a global dumping ground
- Modeling UI behavior as events

---

## What You Start Doing

- Designing store methods as a real API: `load()`, `refresh()`, `submit()`, `reset()`
- Asking "who owns this state?"
- Separating stored vs derived state
- Treating reset as a first-class concern
- Using events only for cross-domain coordination
