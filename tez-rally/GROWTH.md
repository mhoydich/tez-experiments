# Rally — the rethink (2026-09-19)

A spec, in the GROWTH.md / PRINT.md tradition: whoever builds next (Claude,
Codex, a human) builds from this. Contracts are untouched by everything
here.

## Where we actually are

Ten weeks live on mainnet:

| | |
|---|---|
| Players declared | **1** (Mike, 4.000, 2026-07-12) |
| Matches countersigned | **0** |
| Court stamps | **0** |
| Contract calls, total | **1** |

The product is sound and the ledger is honest. Nobody can get in. Reasons,
in order of damage:

1. **Wallet first.** Every real action starts with "connect a Tezos
   wallet." At a court, that is the end of the conversation.
2. **A match needs four wallets.** Reporting asks for opponents' `tz1…`
   addresses. Nobody at open play knows theirs. The countersigned match —
   the whole point — needs 2–4 people to have already onboarded before it
   can happen once.
3. **The number is buried.** "Your rating, on the record" is the promise;
   the rating control was the last thing on a very long page, hidden until
   a wallet connected. The first thing a visitor could actually do was a
   photo booth.
4. **Nothing to do weekly.** A rating is a thing you set once. There was no
   reason to come back Tuesday.
5. **The individual is the wrong unit.** Pickleball is adopted by *crews* —
   the Tuesday group, the ladder league, the eight people in a group chat.
   One organizer decides; everyone else follows a link.
6. **Two self-rating systems.** THAS HER's SLSaaS and Rally's `declare`
   are the same idea on two stacks.

## The thesis

**Rally is the crew's scorekeeper first and a ledger second.** Be useful to
one organizer with zero accounts tonight; let the record harden later, one
claimed name at a time.

The trust ladder already is Rally's grammar. Add a rung *below* it:

```
tally        the organizer's phone kept score          (no accounts — NEW)
claim        "that name is me" + a declared number     (wallet, soulbound card)
record       everyone on the court countersigned       (only this moves the ladder)
attestation  a venue keeper signed                     (planned)
evidence     the tape hash is on the match             (live)
```

Each rung is optional and each one is more believable than the last. The
ladder stays truthful: tallies never touch it.

## The loop

```
organizer opens /tonight/ ──► types 8 names ──► fair rounds, tap scores
        ▲                                              │
        │                                              ▼
next Tuesday ◄── recap card in the group chat ◄── standings + session Elo
                        │
                        └─► "that's me" ──► declare ──► countersign ──► ladder
```

Acquisition is the recap card in the group chat. Retention is next
Tuesday. Conversion is a player wanting their line to be *theirs*.

## Site map (reorganized)

| Route | Job | Wallet |
|---|---|---|
| `/` | **What's your number?** Level finder in the hero → card → the desk → the ladder. Then club tools, then the booth. | optional |
| `/tonight/` | **Open play desk.** Names → fair rotating-partner rounds → scores → standings, session Elo (the contract's exact integer formula), recap card, share link. | none |
| `/paddle-fund/` | Crew money game (concept). | none |
| `/#booth` | Portrait booth; House League lives here as starter presets. | optional |
| `/#board` | The ladder + countersigned matches. | none |
| `/api/mcp` | Agents read the ledger. | none |

Shipped with this document: the `/` reorganization, the level finder, and
`/tonight/` v1.

## Roadmap

**P0 — shipped 2026-09-19**
- Level finder in the hero (no wallet); choice carries into `declare`.
- Front page reordered: number → desk → ladder → tools → booth.
- `/tonight/` v1: local-only sessions, share-by-link, recap card.

**P1 — make the tally claimable (the conversion step)**
- *Names, not addresses.* `.tez` domains and a Rally handle map so the
  report form takes "dana" not `tz1…`. Handle registry can be a signed
  profile message (the booth already does gas-free signatures).
- *Claim a line.* From a shared `/tonight/` link, "that's me" → connect →
  declare at the session's ending number → the session shows a ✓ beside
  claimed names.
- *One-tap countersign.* When all four names in a tallied game are claimed,
  offer "put this one on the record": pre-filled `propose_match`, the other
  three get a countersign link. No typing.
- *Gasless first declare.* A relayer pays the first `declare`
  (tez-onboard's `claim_for` pattern). A new player should never need to
  buy tez to get a card.

**P2 — the crew page (the retention step)**
- `/c/<crew>` — a standing group: roster, season table rolled up from its
  `/tonight/` sessions, next session, recap archive, its paddle fund.
  Needs a small KV-backed API (the first server state Rally would own
  besides the oracle). Live shared scoring (several phones, one session)
  rides the same API.
- Season awards as soulbound stamps (tez-stamps): champion, biggest climb,
  iron player. Same three the paddle fund side pot pays.

**P3 — venues (the step-change)**
- QR on the fence: scan → stamp the passport (GPS stays as the second
  factor) → tonight's session at this court.
- Venue keeper attestation (third rung). A house ladder for California
  Smash is one conversation away from hundreds of players — but only after
  a crew or two already runs on Rally there. Don't pitch a venue an empty
  ladder.

**P4 — one number, many doors**
- THAS HER's SLSaaS reads and writes the Rally contract instead of its own
  KV ladder: the zine is the voice, Rally is the record. Same for any Pro
  Shop tool that wants a level.
- PointCast `/rally` door is a 404 since the main-lineage rewrite; restore
  it as a Court-channel page when there is a second player to show.

## Who we grow with, in order

1. **Mike's own games.** The Squeeze, the Hollyglen regulars, El Segundo
   Rec league night. Run `/tonight/` on Mike's phone for three sessions.
   The test: does someone else ask for the link?
2. **One other organizer.** The person who runs a different night. If they
   use it unprompted twice, the wedge is real.
3. **THAS HER readers.** A Tuesday-league audience that already has a
   self-rating habit.
4. **One venue.** Only with 1–3 already working.

## What we will not do

- Manufacture users, ratings, or matches to look alive. House characters
  stay labelled fictional; an empty ladder stays empty.
- Put tallies on the ladder. Only countersigned matches move a rating.
- Chase DUPR on its ground (tournament eligibility, club integrations).
  Rally's ground: open formula, public ledger, works for eight friends
  tonight with no sign-up.
- Require a wallet for anything that is not a signature.

## Measures (check monthly, from the ledger and nothing else)

- Sessions run on `/tonight/` by someone who is not Mike (needs P2's API
  to be countable; until then, ask).
- Declared players. Countersigned matches. Court stamps.
- The ratio that matters: **countersigned matches per declared player.**
  A ladder of cards with no matches is a guest book.
