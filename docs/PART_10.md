# Part 10 — animation and interaction polish

Part 10 adds a single interaction-feedback layer on top of the server-authoritative systems delivered in Parts 1–9. It deliberately does **not** move reward calculation or game state into the browser. Animations happen only after an existing API mutation confirms success.

## Goals

- Make quest completion, XP gains, level-ups, purchases, and equipment changes feel immediate and deliberate.
- Keep feedback tied to confirmed server results instead of optimistic fake rewards.
- Avoid replaying reward celebrations after a refresh or query refetch.
- Give keyboard and screen-reader users the same meaningful confirmation as sighted users.
- Respect both the in-app motion preference and the operating system `prefers-reduced-motion` preference.
- Keep decorative animation brief. There are no new infinite particle systems.

## Interaction feedback provider

`client/src/interactions/InteractionProvider.jsx` owns cross-page feedback.

It exposes:

- `notify(...)` for confirmed, transient feedback.
- `announce(...)` for screen-reader-only status announcements.
- `moving`, which is true only when the user allows gentle motion and the OS is not requesting reduced motion.

The provider renders at most three recent visual notices and one polite live region. Visual notices are `aria-hidden` so announcements are not duplicated.

Confirmed events may include a stable server identity such as a completion receipt or inventory item. Stable identities are remembered during the current app session so the same mutation response cannot trigger the same celebration twice.

Nothing is restored from local storage on reload, and query hydration does not emit interaction events, so a page refresh never replays old rewards.

## Sound

Part 9 introduced the device-local “Celebration sounds” setting. Part 10 consumes it.

Sounds are:

- generated through the Web Audio API,
- very short,
- initiated only after a confirmed user action,
- disabled by default,
- skipped silently if the browser cannot start an audio context.

No audio file is fetched and no gameplay data depends on audio support.

## Quest completion

`CompleteQuest` now:

1. waits for the secure completion API,
2. renders the immutable reward receipt,
3. emits global feedback only when `newlyCompleted === true`,
4. uses the receipt ID as the deduplication key,
5. animates the XP progress meter and reward values,
6. shows a brief floating XP label,
7. gives level-ups a stronger but short-lived visual treatment,
8. focuses the confirmed result heading after completion.

A duplicate retry that recovers an already-recorded receipt does not celebrate or play a sound again.

## Quest-list transitions

The Quest Journal and Dashboard use layout-aware list transitions. Removing a one-time quest from the active set, archiving it, or changing eligibility lets surrounding rows settle into place rather than jumping.

These transitions use the existing query invalidation path. No row is removed locally before the server accepts the action.

## Purchases

The Marketplace keeps the preview dialog open after a successful purchase and turns it into a confirmation view. This makes the change in ownership and remaining gold visible before the user continues.

The feedback sequence is:

1. purchase button shows a contextual pending state,
2. server commits the atomic wallet + ownership transaction,
3. the purchased artwork is revealed,
4. remaining gold is displayed,
5. the catalog balance animates to its new value,
6. the purchased card receives one brief highlight,
7. the live region announces the purchase.

The notification is keyed by the new inventory-item ID, so a replayed response cannot repeat the celebration.

## Equipment

Inventory actions now show an item-specific pending state instead of making the whole page appear ambiguously busy.

After a confirmed equip or unequip:

- the changed inventory card receives a brief highlight,
- the equipment strip uses a layout transition,
- the global live region announces which slot changed,
- equipped themes continue to update through the existing authenticated-user cache refresh.

## Dialog motion and focus

Generic dialogs, quest editor/details, and completion dialogs use the same short fade/movement language. The movement animates `margin-top` instead of `transform` so it does not overwrite the CSS transform responsible for centering Radix dialogs.

Focus behavior remains explicit:

- quest editor returns to the journal action,
- quest details return to the journal action,
- completion returns to the button that launched completion,
- Marketplace returns to the preview/manage control for the same item,
- the field guide returns to the button that opened it.

Marketplace has a selector fallback because a successful purchase replaces the original Preview button with a Manage link while the dialog is still open.

## Route transitions

Authenticated and public route shells use a short fade/vertical transition. The transition is keyed by pathname only, so changing Quest Journal search/filter parameters does not remount the entire page.

The existing main-region focus behavior remains intact for keyboard navigation.

## Reduced motion

Motion is disabled when either:

- Settings → Gentle animations is off, or
- the OS requests reduced motion.

The app's existing `data-motion="off"` fallback remains in place for CSS animation. Motion components also receive zero-duration transitions directly.

The old decorative firefly group was changed from an infinite animation to a single short entrance. Completion particles are also finite.

## No persistence or migration changes

Part 10 does not add database columns, migrations, API endpoints, or npm dependencies. `motion` and Radix Dialog were already part of the client dependency set.

## Manual verification checklist

1. Complete a new one-time quest. Confirm XP/gold/attribute rewards animate only after the request succeeds.
2. Retry the same completion response. Confirm no second celebration or duplicate reward appears.
3. Complete a quest that crosses a character level. Confirm the stronger level-up treatment and accessible announcement.
4. Close the completion dialog with the keyboard. Confirm focus returns to the launching control.
5. Buy a marketplace item. Confirm the dialog becomes a purchased state and the gold balance updates.
6. Close the purchase dialog. Confirm focus returns to the same item's Manage action.
7. Equip and unequip cosmetics. Confirm only the clicked action shows pending state and the inventory/equipment surfaces update.
8. Turn Gentle animations off and repeat the flows. Confirm state changes remain clear without motion.
9. Enable OS reduced motion and repeat. Confirm the OS preference wins.
10. Enable celebration sounds and repeat a confirmed quest/purchase/equip action. Confirm audio is brief and absent when the setting is disabled.
11. Refresh on Character, Marketplace, Inventory, and Dashboard. Confirm old celebrations do not replay.
12. Navigate every dialog with Tab/Shift+Tab, Escape, Enter, and Space.
