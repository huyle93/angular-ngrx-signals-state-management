# Stacked Marketing Banner -- Dynamic Font Scaling Instructions

> Context: Ionic Angular hybrid mobile investing app (iOS/Android via Capacitor WebView). Component lives in `libs/invest-app/<domain>/ui/`. Built with Angular standalone components, signal-first reactivity, Ionic UI primitives, SCSS. The portfolio page surfaces this component.

---

## What This Component Is

A compact, tappable stacked card deck on the portfolio page. Surfaces short marketing or product-promotional messages. One card visible at a time, others stacked behind.

This is NOT a freeform content container, scrollable list, or rich-text area.

The component must feel: premium, stable, compact, aligned across all cards, resilient to device-level font scaling, safe against content overflow.

---

## Core Mental Model

**The deck is one shared shell. Cards are interchangeable content inside that shell.**

- The deck owns layout geometry. Content must fit within the deck.
- Every card uses the same structural slots and the same height for the current mode.
- Content swaps inside a stable shell. Content does not decide card height.
- Difference in copy length is acceptable. Difference in shell geometry is not.

---

## Principles (ranked by priority)

1. Deck owns height, not content.
2. All cards in a mode share identical shell height.
3. Clamp content; never auto-grow per card.
4. Support larger text through deck-level mode switching, not per-card resizing.
5. Top-align text; never vertically center mixed-length content.
6. Dismiss control must be isolated from card tap.
7. This pattern is for short-form messaging only.
8. Govern content upstream with clear limits.

---

## Interaction Model

**Primary action** -- entire card is tappable; opens destination.

**Secondary action** -- X button dismisses current card; reveals next card in stack.

Rules:
- Dismiss tap must call `stopPropagation()` to prevent triggering card navigation.
- Dismiss control must remain fixed-position and reachable at all font sizes.
- Card tap area must remain stable regardless of text length.
- Content must never push or overlap the dismiss control.

---

## Layout and Height Rules

**Non-negotiable:** all cards in the same deck mode have the same height.

The deck supports two modes:
- **Standard mode** -- default device font size.
- **Large text mode** -- activated when device accessibility font scaling exceeds a threshold.

Within each mode, every card height is identical. If accessibility requires more space, switch the entire deck to the larger mode. Never let one card stretch while others stay shorter.

**Card slots** (fixed structural regions, consistent across all cards):
- Icon / leading visual
- Title (max 2 lines)
- Description (max 2 lines)
- Dismiss button
- Tappable shell container

**Height is sized for worst allowed layout:** icon + 2-line title + 2-line description. If actual content is shorter, unused vertical space remains. The shell does not shrink.

---

## Text Scaling Behavior

The component must honor device-level dynamic font scaling (iOS Dynamic Type, Android font size settings). Do not disable or override system font scaling.

**Text overflow strategy:** wrap, then clamp, then ellipsis.

- Title: wrap up to 2 lines; ellipsis if exceeded.
- Description: wrap up to 2 lines; ellipsis if exceeded.

**Overflow priority when content pressure occurs:**
1. Preserve deck height consistency.
2. Preserve title readability.
3. Clamp description first.
4. Hide extra overflow.
5. Reject overlong content upstream through content governance.

**In large text mode:**
1. Title remains readable (highest priority).
2. Dismiss remains reachable.
3. Card tap area remains intact.
4. Description may truncate earlier.

**Never do:**
- Disable font scaling to protect layout.
- Allow per-card height growth.
- Allow text to overlap icon or dismiss control.
- Allow content to spill outside card shell.

---

## Vertical Alignment

Text content is top-aligned. Not centered.

Reason: keeps title start position consistent across cards, prevents visual jump during card transitions, keeps short and long copy visually disciplined.

---

## Animation and Transitions

When a card is dismissed and the next card appears:
- Shell height remains constant.
- No layout reflow or height jump.
- Transition reads as content replacement inside a stable deck, not a resizing container.

This is why shared-height is required.

---

## Content Governance (for Marketing and Product)

This component is for **short-form, glanceable messaging only**.

**Suitable for:** feature promotion, lightweight product education, soft nudges, account/product discovery.

**Not suitable for:** long educational text, multi-step instructions, critical disclosures, legal/compliance content, any message requiring guaranteed full visibility. Use a different component pattern for those.

### Copy Limits

| Field | Target | Hard Max | Notes |
|---|---|---|---|
| Title | 24-34 chars | 40 chars | 1-2 lines at default size |
| Description | 50-80 chars | 100 chars | Must remain concise |
| Total message | ~100 chars | ~130 chars | Compact only |

### Writing Rules

- One idea per card.
- Title communicates the core value. Description supports it.
- No filler ("Tap to learn more").
- No paragraph-style copy.
- No repeated meaning between title and description.
- Content must still make sense if description truncates.
- Write for small mobile surfaces, limited line budget, possible truncation, and accessibility-scaled text.

---

## Review Checklist

**Product:** Is this message compact enough for a card? Should it be a modal or inline section instead? Is truncation acceptable?

**Marketing:** Is title under 40 chars? Is description under 100 chars? One idea per card? Still readable if description truncates?

**UX:** Visually balanced on small screens? Stable at larger text sizes? X easy to tap without accidental card-open? Stack aligned across all cards?

**Engineering:** All cards using same deck height token? Dismiss isolated from card tap? Title/description clamped? Overflow contained? No per-card height growth?

---

## AI Agent Instructions

**Task:** Enhance the existing stacked marketing banner component to be bulletproof under dynamic font scaling while preserving the shared-shell deck model.

**Approach:** This is a refinement of existing implementation, not a rewrite. Adjust CSS, layout tokens, and conditional mode switching. Do not restructure the component architecture.

**Rules:**
1. Do not allow card height to auto-grow per item content.
2. All cards in one deck mode use the same shell height.
3. Larger text support via shared deck-level mode, not per-card resizing.
4. Title and description have independent line clamps (2 lines each).
5. Content must never overlap the dismiss control.
6. Dismiss button tap must stop propagation.
7. Text content is top-aligned, not vertically centered.
8. Overflow handled by clamping/truncation, not expansion.

**Anti-patterns to avoid:**
- Height based on content measurement per card.
- Dynamic stack offsets based on card text length.
- One card stretching taller than others.
- Vertically centering short text causing visual misalignment across cards.
- Solving overflow by shrinking touch targets.
- Dismiss button participating in normal text flow.

**Expected outcome:**
- Standard mode: all cards visually identical in shell height.
- Large text mode: all cards visually identical in a larger shell height.
- Longer copy truncates safely.
- Stack stays aligned and premium.
- Dismiss and card-open interactions remain distinct.
- Component honors iOS Dynamic Type and Android font scaling without breaking.
