# SCOPE — venice-drum-circle

The template ladder meets the sand. A recurring physical drum circle whose
every session dispenses an on-chain badge to everyone who showed up, with
the session's details noted in the badge metadata forever.

This is the first *anchored* app in the series: tez-onboard is the door,
tez-stamps is the machinery, the circle is the reason to walk through.

## The loop

```
  circle happens → you're there → tap one link → badge in wallet
                                                  (session details noted)
```

1. A session is opened (by a keeper, or on a standing schedule).
2. Attendees hit a QR/link on the sand. First-timers flow through
   tez-onboard: Kukai social login, seeded, sixty seconds, mid-drum-circle.
3. They claim the session badge — one per wallet per session.
4. The badge is a soulbound FA2 stamp whose metadata notes the details:
   session number, date, location tag, and a free-text field the keeper
   writes after ("full moon, ~200 people, someone brought a sousaphone").

Attend ten circles, your wallet says so — legibly, portably, forever.
And when tez-nouns ships, the drum lineage accessory pool is already
specced: your noun gets drumsticks because you actually drummed.

## Badge design

One stamp **type per session**, minted from the tez-stamps registry:

- `name`: "Venice Circle #041"
- `description`: keeper's field notes, written within 24h
- `date`, `location`: structured TZIP-21 attributes
- `series`: "venice" — so readers can count circle badges as a lineage
- soulbound, one per wallet per session (registry already enforces this)

A meta-lineage stamp ("Ten Circles") can be issuer-minted automatically
when a wallet's venice-series count crosses thresholds — the verificational
composing with itself.

## Attendance gates — pick one to start

| gate | how | honesty | friction |
|---|---|---|---|
| **time-window open claim** | stamp type opens 30 min into the session, closes at sundown; QR on-site is the only place the link is shown | honor-system; remote claimers possible if link leaks | lowest — MVP choice |
| **keeper-signed voucher** | keeper's phone signs vouchers for people who scan on-site (`signed` gate, already built) | strong — can't forge, keeper attests presence | keeper does a little work |
| **geofenced check-in** | app requests location, backend signs voucher only inside the geofence + window | strong-ish; GPS spoofable by the motivated | medium; needs a tiny backend |

Recommendation: launch with **time-window open**, graduate to
**keeper-signed** the moment badges start mattering (i.e., once tez-nouns
reads them). The rule from TRAITS.md applies: while the gate is soft, the
derived trait pool stays visually plain.

## Roles

- **Keeper** — opens/closes the session stamp, writes the field notes,
  holds the issuer key. Rotates; keeping is itself a badge.
- **Attendee** — taps, claims, drums.
- Nobody else. No accounts, no moderators, no feed.

## What gets built (MVP cutlist)

1. `venice.html` — a single page composing tez-onboard connect +
   tez-stamps claim, styled for sunlight-readable use on the sand
2. `scripts/open-session.js` — keeper CLI: creates the session stamp type,
   prints the QR
3. `scripts/close-session.js` — closes the window, writes field notes into
   metadata
4. Lineage counter — a read-only view/page: "wallets by circles attended"

That's it. No new contracts — the stamps registry already does everything.
Estimated build: a weekend, because templates.

## Open questions (decide on the sand, not in the doc)

- Cadence anchor: attach to the actual standing Venice Beach circle, or
  seed a new smaller circle with its own rhythm? (Attaching inherits crowd
  and chaos; seeding inherits nothing but is yours.)
- Does the physical circle *know*? Signage vs. word-of-mouth-only — the
  quiet version is more El Segundo Cinematic Universe.
- Keeper key custody when keeping rotates — social recovery vs. multisig
  vs. just reissue.
- Sound: should claiming make the phone drum? (Yes. Obviously. But scope.)

## Why this one matters

Every prior surface in the drum lineage is digital-native. This is the
inversion — chain as memory for something that only exists as bodies,
rhythm, and sunset. If wallet-as-passport works *here*, where nothing about
the activity is on a screen, it works anywhere.
