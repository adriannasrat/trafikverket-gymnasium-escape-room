# Manual rehearsal checklist

This checklist complements the automated test suite. It should be completed by
at least one person who has not seen the project before. The facilitator should
observe without explaining how the experience works unless the participant
would otherwise be unable to continue.

## Preparation

- [ ] Start the version intended for public use and verify `/health/ready`.
- [ ] Use an empty demo or event leaderboard and a known administrator account.
- [ ] Have a mobile phone, the actual event display, and the event keyboard and mouse available.
- [ ] Ask the participant to use a nickname rather than their real name.
- [ ] Record the screen size, browser, approximate duration, and every point where the participant hesitates.

## Unassisted participant journey

- [ ] The participant understands that their nickname is public and how long the result is retained.
- [ ] The participant can start the game without help and understands that the total time starts immediately.
- [ ] The participant understands the instructions for all seven games before interacting with them.
- [ ] `Risk & Säkerhet`, `Sortera rätt`, and `Bilda ordet` can be completed with a mouse or touch and without drag-and-drop.
- [ ] Correct answers, incorrect answers, lost lives, points, pauses, and the **Försök igen** (Try again) action are clearly understood.
- [ ] The participant understands when a challenge is complete and uses the next button without help.
- [ ] The final result and leaderboard are understandable, including score, time, and incomplete attempts.

## Keyboard and focus

- [ ] Complete a full session using `Tab`, `Shift+Tab`, the arrow keys, `Enter`, and the space bar.
- [ ] Focus indicators are visible on every link, field, answer, and button.
- [ ] Focus never becomes trapped, and its order follows the visual content.
- [ ] Every drag interaction has a working button- or selection-based alternative.
- [ ] Every game remains readable and completable at 200% zoom.
- [ ] Animations remain calm and understandable when reduced motion is enabled in the operating system.

## Displays and network conditions

- [ ] The player view works on the physical event display at the normal viewing distance.
- [ ] Important text, the timer, remaining lives, and the next action are easy to locate.
- [ ] The player and admin views work on a real phone in portrait and landscape orientation.
- [ ] Enable a slow network connection and confirm that loading states are visible.
- [ ] Disconnect the network during session creation, answer submission, and page loading; reconnect and use **Försök igen** (Try again).
- [ ] Confirm that no duplicate answer, duplicate result, or lost admin change occurs.

## Administration and cleanup

- [ ] Sign in, edit a question, and confirm that autosave reports success.
- [ ] Reload the page and confirm that the change persists.
- [ ] Check admin on mobile, including navigation, forms, accordions, and image management.
- [ ] Restore all edited content and remove rehearsal results and uploaded test images.

## Acceptance criteria

The rehearsal passes when a new participant can complete the experience without
instructions, every blocking keyboard, display, and network issue has been
resolved, and all test data has been removed. Cosmetic improvements that do not
prevent understanding or completion can be recorded for a later release.

## Already verified automatically

The following checks are covered by the project's automated test suite. They
complement rather than replace the human rehearsal:

- keyboard activation through admin and all seven games in the isolated full-stack journey,
- a visible focus indicator on answer choices,
- recovery from interrupted initial page loads and answer submissions,
- a visible loading state during a deliberately delayed reload,
- no horizontal overflow in any of the seven games at 360×800 or 430×932,
- no horizontal overflow in admin at either mobile viewport,
- no horizontal overflow in any of the seven games at 1920×1080.

Run these checks with:

```sh
cd apps/web
npm run test:e2e
cd ../..
./scripts/test-full-stack-e2e.sh
```
