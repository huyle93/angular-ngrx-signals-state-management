# Clean Code Rules — North Star

> Reference for all technical work: architecture, solution design, development, PR review.
> Based on Neo Kim's 6 Clean Code Rules.

---

## 1. Separation of Concerns (SOC)
- ☑ Break a complex program into smaller units.
- ☑ Each unit owns one task; boundaries are explicit.

**Why:** Change isolates to one place. The unit of design is responsibility, not line count.

---

## 2. Document Your Code (DYC)
- ☑ Write for your future self and others.
- ☑ Comment the *why*, not the *what*; let names carry the *what*.

**Why:** Code says how; it can't say why. Document intent, trade-offs, and non-obvious constraints.

---

## 3. Don't Repeat Yourself (DRY)
- ☑ Don't rewrite the same logic — use functions, modules, libraries.
- ☑ Apply the Rule of Three: abstract on the 3rd repeat, not the 1st.

**Why:** One source of truth per decision. But premature abstraction is costlier than duplication — prefer duplication over the *wrong* abstraction.

---

## 4. Keep It Simple, Stupid (KISS)
- ☑ Simplest solution that fully works.
- ☑ Readable code > clever code.

**Why:** Code is read far more than written. Complexity is a liability you pay for forever.

---

## 5. Test Driven Development (TDD)
- ☑ Write a failing test first (Red).
- ☑ Write just enough code to pass (Green).
- ☑ Clean up without changing behavior (Refactor).

**Why:** Tests pin behavior so refactoring is safe. Red → Green → Refactor separates "make it work" from "make it clean" — they are different jobs.

---

## 6. You Ain't Gonna Need It (YAGNI)
- ☑ Build only what's required now.
- ☑ Don't build for a future you're guessing at.

**Why:** Speculative features add cost and lock in wrong assumptions. Decide late, when you have real information.

---

## How to Apply (Sequencing)

Order matters more than the list. Apply in two phases, not all at once:

**Phase 1 — Front-load (shape the first draft):**
- **SOC** — set boundaries before writing; they don't require finished code.
- **KISS / YAGNI** — simplest thing that works, no speculative structure.

**Phase 2 — After it works, refactor (needs the real shape):**
- **DRY** — remove *real* duplication once you can see it (Rule of Three).
- **TDD** — spans both: correctness first, cleanup in the Refactor step.

**Rule of thumb:** Correctness first, abstraction last. You can't see the right abstraction until the code exists.

---

## PR Review Lens
Ask, in order:
1. Does it work and is it tested? (TDD)
2. Is it the simplest version? (KISS / YAGNI)
3. Are concerns and boundaries clean? (SOC)
4. Is there *real* duplication, or premature abstraction? (DRY)
5. Will the next person understand *why*? (DYC)

---

*Core principle: optimize for the reader and for change. Clean code is not the cleverest — it's the one that's cheapest to understand and safest to change.*