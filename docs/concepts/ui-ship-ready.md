# Ship-Ready UI

A frontend quality framework for mobile product engineers.

**Status:** v3 — source of truth. Slide deck and wiki page derive from this document.
**Audience:** Frontend / mobile engineers and engineering leadership.
**Scope:** High-level quality model. Not an exhaustive QA checklist. Framework-agnostic.

---

## 1. Why this exists

Frontend is where everything we build becomes real for the customer. Everything upstream — services, data, infrastructure — is invisible. The screen is the product.

Something can be technically correct and still not feel finished.

> **Functional is not the same as finished.**

The difference is rarely one large defect. It is usually a set of small things that individually look minor and collectively decide whether the app feels professional.

The API works. The form submits. The button responds. The tests pass. And something is still off.

That "off" feeling now has a second, newer form:

> Does this screen feel **polished**, or does it feel **generated**?

Both questions point at the same thing. A screen can be correct and still look like nobody decided anything.

Most of those things get caught downstream — by UX, by Product, by QA, or by whoever happens to notice in review. That works, but it is the most expensive place to catch them, and it does not scale.

This framework moves that judgment upstream, to the engineer who built the screen.

---

## 2. Where design ends and engineering begins

This framework is deliberately scoped to what an **engineer** owns. That boundary matters, because quality conversations usually blur it — and engineers end up either doing design's job or ignoring quality entirely.

| Design / design system owns | Engineering owns |
|---|---|
| Color, contrast ratios, type scale | Using the tokens as specified — no ad-hoc values |
| Component design and variants | Using the existing component instead of a one-off |
| Spacing scale, layout intent | Applying the scale correctly across real content |
| Which states should exist | That every state actually exists and was looked at |
| Touch target and accessibility standards | That the implementation still holds at scale, on device |

**The consequence worth internalizing:**

> Most accessibility failures in our code are not design errors. They are **design-system deviations** — a hard-coded color, a custom component, a spacing value someone eyeballed.

If we implement the system faithfully, contrast and type accessibility largely come for free. Our failures are fidelity failures. That is an engineering problem, and it is squarely in scope.

What stays engineering-owned is everything a design file cannot show: text scaling at maximum, long content, small devices, safe areas, focus order, and what happens when the data is missing or the network is bad.

**This got harder, not easier, with AI.**

AI produces *plausible* values, not *system* values. It will confidently hand you a button with 48px of padding for no reason — a number that looks reasonable, renders fine, passes every automated check, and is not in our scale. Generated code deviates from the design system quietly and at volume.

That is why fidelity is a blocker rather than a nitpick. The cost of a one-off value used to be one careless engineer. Now it is the default output unless someone checks.

---

## 3. The model

Three questions. Nearly every UI quality problem we ship is a failure of one of them.

| Layer | The question | What it protects |
|---|---|---|
| **Craft** | Does it match the intent? | Trust and perceived professionalism |
| **Behavior** | Does it survive reality? | Correctness outside the happy path |
| **Speed** | Does it feel instant? | Customer patience and confidence |

**Why three and not one:**

1. They fail independently. A screen can match the design pixel-for-pixel and still break on a slow network.
2. They have different sources of truth. Craft is fidelity to a spec that exists. Behavior and Speed are judgment — no design file hands you those.
3. They need different tools. Craft is reviewable from a screenshot. Behavior and Speed are only reviewable on a device.

Craft is where most quality conversations start. Behavior and Speed are where the actual gap is.

---

## 4. The seven checks

### CRAFT — fidelity to intent

**1. Visual Fidelity**
Does the built screen match the design, with real content?
*The test:* alignment, spacing rhythm, hierarchy — checked against long names, large numbers, missing values, not the placeholder data in the mock.
*Also ask:* would a real user understand this screen without thinking? Is each animation doing a job, or is it decoration?
*Failing signal:* hard-coded spacing or color values; a layout that only holds with ideal content; motion that nobody asked for.

**2. Consistency**
Same problem solved the same way, everywhere.
*The test:* does this screen use existing components and tokens, or quietly invent new ones?
*Failing signal:* a new one-off variant of something that already exists in the system.
> The cheapest quality win available to us, and the one most often skipped under deadline.

### BEHAVIOR — survives reality

**3. States**
Loading, empty, error, disabled, success, partial, stale, long content.
*The test:* can you actually reach every state, and does each one look deliberate?
*Failing signal:* the state exists in code but nobody has ever seen it rendered.
> The single biggest gap between a design-complete screen and a shippable one.

**4. Interaction**
Tap, scroll, focus, keyboard, navigation, back and dismiss behavior.
*The test:* does every action acknowledge the user immediately, and can they always get out?
*Failing signal:* a tap with no visible response; the keyboard covering the control you need to press.

**5. Environment Resilience**
Text scaling, device sizes, safe areas, orientation, offline and slow network.
*The test:* largest text setting, smallest supported device, degraded connection.
*Failing signal:* truncated or clipped text; controls under the notch or home indicator; content that vanishes when a request fails.

### SPEED — feels instant

**6. Perceived Performance**
Immediate feedback, useful content before spinners, stable layout, progressive loading.
*The test:* does it *feel* fast, independent of how long the network actually took?
*Failing signal:* a blank screen and a spinner where last-known-good data could have rendered; layout that jumps as content arrives.
> A screen that loads in 700ms without moving feels faster than one that loads in 500ms and shifts.

### THE GATE

**7. Final Validation**
Use it. On a device. Beyond the happy path. On both platforms.
*The test:* **would I hand my phone to a customer with this screen open — on an older device, on poor wifi, at the largest text size?**
*And:* **does this feel polished, or does it feel generated?**
*Failing signal:* the screen has only been seen on one platform, at default settings, with clean data.

---

## 5. The five that are not optional

Seven checks are the thinking tool. Not all seven carry the same weight.

A framework where everything is important enforces nothing. These five are the ones worth sending a PR back for:

| # | Not optional | Why |
|---|---|---|
| 1 | Loading / empty / error state missing or never rendered | Guaranteed to be hit in production |
| 2 | Content disappears on a failed or slow refresh | Reads as data loss; destroys trust |
| 3 | Layout shifts or jumps during load | Reads as broken, and causes mis-taps |
| 4 | Breaks at largest text size or on smallest supported device | Real customers, silently excluded |
| 5 | Design-system deviation without justification | Compounds; every one-off becomes permanent |

Everything else — optical alignment, animation easing, micro-copy — is **polish**. Worth raising in review, not worth holding a PR for.

**Why five:** five is enforceable in review. Fourteen is a wish list.

### What this framework does not cover

This is the **product-quality** pass. It sits alongside code review; it does not replace it.

| Code review owns | This framework owns |
|---|---|
| Architecture and module boundaries | Whether the screen is finished |
| Correctness, edge-case logic, data handling | Whether every state was rendered |
| Test strategy and coverage | Whether it holds on a real device |
| Performance of the implementation | Whether it *feels* fast to the customer |
| Security, error handling, API contracts | Whether it matches the design system |

Both passes are required. They answer different questions, and a PR can pass one cleanly while failing the other.

---

## 6. What this changes in Definition of Done

Today, implicitly:

```
Implement → Open PR → Product / UX / QA find the gaps
```

Proposed:

```
Implement → Validate → Refine → Open PR
```

One added step, and it is the whole point: **the engineer is the first line of validation, not the last.**

Product, UX and QA should be confirming quality, not discovering it.

---

## 7. Why now: AI changed what is scarce

AI has made implementation dramatically faster. It has also absorbed most of the mechanical checks we used to spend attention on.

| AI reliably handles | Engineer owns |
|---|---|
| Writing and refactoring implementation | Whether it matches the intent |
| Compile, lint, type checks, build | Interaction feel on a real device |
| Unit and integration tests | State coverage nobody specified |
| Finding omissions in code | Perceived performance |
| Generating the happy path | The decision to ship |

```
AI makes writing code faster
        ↓
Writing code is less of the bottleneck
        ↓
More software gets produced, faster
        ↓
Judgment and validation matter MORE, not less
```

**This is not an argument that AI is bad at UI.** It is getting very good, and the gap narrows every release. The gap is not about capability — it is about the distance between two sentences:

```
"Here is a working screen."
                ↓
"This is ready for customers."
```

AI closes the first one fast. The second is still a judgment call, and it is still ours — for now, and worth re-examining as the tools change.

Three things worth stating plainly:

- **Speed does not transfer accountability.** Whatever generated the code, a person owns whether it ships.
- **Speed without taste produces generic products.** Faster output raises the floor and does nothing for the ceiling.
- **Quantity of software will increase. Quality stays differentiated.**

Craftsmanship is the last mile. It is the final touch, and it is our responsibility.

### The validation pass

The concrete practice this implies. By the time you are ready to open a PR, the automated gates are already green — tests, lint, build, types. Those are table stakes now, not validation. The time AI gives back gets spent here instead:

**1. Run it natively, on both platforms.**
iOS simulator and Android emulator. Walk the seven checks. Interaction, navigation, keyboard, every state you can reach. Platform differences show up here and nowhere else.

**2. Run a performance pass.**
Watch the network calls. Watch the loading sequence. Is there a blank frame? Does the layout settle, or jump? Does useful content arrive before a spinner would have? Throttle the connection and do it again.

**3. Then open the PR.**

The PR should be the point where you are confident — not the point where you find out.

---

## 8. How this scales

The goal is not for one person to catch every detail. If quality depends on a specific reviewer noticing things, we don't have a quality system — we have a bottleneck.

```
V1   Shared framework          ← this document
      ↓
V2   Engineers self-validate   ← the PR checklist below
      ↓
V3   AI-assisted validation    ← pilot, opt-in
      ↓
V4   Automated guardrails      ← the mechanical subset only
```

Only part of this is automatable: token deviation, touch target size, layout shift, state coverage, text scaling. That subset is worth automating precisely *because* it is mechanical.

Judgment — hierarchy, whether something feels finished, whether it should ship — stays with the engineer. That is not a limitation of the tooling. It is the part of the job that matters.

**The goal is not more process. The goal is to make high quality easier to achieve consistently.**

---

## 9. Takeaway: PR checklist

Copy into the PR description, or into the PR template.

```markdown
### Ship-Ready UI — product quality pass

_Complements code review; does not replace it._

**Not optional**
- [ ] Loading, empty and error states exist, rendered and reviewed
- [ ] Content survives a failed or slow refresh — nothing disappears
- [ ] No layout shift or jump during load
- [ ] Holds at largest text size and on smallest supported device
- [ ] No design-system deviation — components, tokens and spacing as specified

**Validated natively**
- [ ] Run on iOS simulator and Android emulator
- [ ] Used beyond the happy path, with real-shaped content
- [ ] Immediate feedback on every action; keyboard and back behavior correct
- [ ] Scroll, transitions and gestures are smooth

**Performance pass**
- [ ] Network calls reviewed — no waterfalls or duplicate requests
- [ ] Useful content renders before, or instead of, a full-screen spinner
- [ ] Checked on a throttled connection

**Final:** would I hand my phone to a customer with this screen open?
```

---

## 10. One-page card

For the wall, the wiki sidebar, or a team channel post.

```
                    SHIP-READY UI

   CRAFT                BEHAVIOR              SPEED
   Does it match        Does it survive       Does it feel
   the intent?          reality?              instant?

   1. Visual Fidelity   3. States             6. Perceived
   2. Consistency       4. Interaction           Performance
                        5. Environment
                           Resilience

                    ─────────────
                    7. FINAL VALIDATION
                    Would I hand my phone
                    to a customer?
```

---

*Owner: Huy. Feedback and proposed changes welcome — this is a team standard, not a personal preference.*