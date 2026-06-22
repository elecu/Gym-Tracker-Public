# RepStack — Engineering Case Study

**Live product**: https://rep-stack.pages.dev/

RepStack is a commercial strength-training tracker I designed, built, and run solo — used daily by my own coaching clients to log workouts, track physique check-ins, and get evidence-based training feedback. This repo is a **curated case study**, not the source code: it documents the architecture and shares one isolated, rewritten code sample so the underlying engineering and reasoning is visible without exposing the product I sell access to.

---

## Why this exists

I'm sharing this as part of a job search. Full source isn't public because RepStack has paying users and the code is the product. What follows is an honest breakdown of how it's built, the data model behind it, and one real algorithm — rewritten standalone for review.

---

## System Architecture

RepStack is a **local-first, serverless** web app — no traditional backend database. Data lives in two places kept in sync:

```
Browser (IndexedDB)  <-- sync -->  Google Drive (JSON state file + photos)
        ^                                  ^
        |                                  |
   instant reads/writes            durable, user-owned storage
   works offline                   survives device loss, multi-device access
```

There's no central server holding user data — each user's training history lives in *their own* Google Drive, as a single structured JSON document plus a folder of check-in photos. This was a deliberate trade-off: zero infra cost for user data storage, trivial GDPR compliance (user already owns/controls the file), and no database to operate — at the cost of building careful merge/conflict logic for the local-vs-remote sync path.

### Data model

The state document is structured around a few core collections:

- **`machines[]`** — the user's exercise catalog (name, primary/secondary muscle group, equipment type). Supports bilingual (EN/ES) name matching and an alias table so gym slang ("Smith Press", "Scott Curl") resolves to a canonical entry.
- **`workoutLogs[]`** — one entry per logged session, containing **`sets[]`** (reps × weight × RPE × timestamps). This is the core fact table everything else derives from.
- **`checkIns[]`** — bodyweight, body-fat estimate, training phase, and photo references, timestamped for a progress timeline.
- Derived, *never stored*: weekly volume, effective-volume-per-muscle-group, e1RM trends, responder classification, recovery-conflict flags — all computed on read from the raw logs (see Data Pipeline below).

### Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla JavaScript, HTML5, CSS3 | No framework overhead for a UI this latency-sensitive (logging a set mid-set, on a gym floor, has to be instant) |
| Local storage | IndexedDB | Offline-first; gym wifi is unreliable |
| Remote storage | Google Drive API v3 (OAuth 2.0) | User-owned data, zero storage infra to run |
| Hosting | Cloudflare Pages + Pages Functions | Static frontend + small serverless functions for auth gating and payment webhook handling |
| i18n | Custom key-based translation system | Full EN/ES coverage across ~170 exercise names and all UI strings |

---

## Data Pipeline

Raw input is deliberately minimal — a lifter logs **reps, weight, RPE** per set. Everything else is computed:

1. **Effective volume** — sets are mapped to primary/secondary muscle groups (validated against an EMG-based muscle map), with secondary-muscle contribution split proportionally so volume isn't double-counted across multiple muscles in a compound lift.
2. **Strength trend (e1RM)** — every set is converted to an estimated one-rep max (Epley formula), then tracked over time per exercise.
3. **Responder classification** — month-over-month e1RM growth rate is compared against literature-backed thresholds to flag high vs. low responders, with an expected-gain ceiling scaled by training age (novice gains taper off — feedback shouldn't promise a beginner's progress curve to a 3-year lifter).
4. **Recovery-conflict detection** — sessions are grouped by muscle group and flagged if the same group is trained twice within 48 hours without adequate volume separation.
5. **Volume adequacy** — weekly per-muscle-group volume is checked against an evidence-based effective range (10–20 sets/week), surfaced as a visual flag rather than a hard rule.

All of this is computed client-side, on read, from the raw log — there's no separate analytics service or stored aggregate to keep in sync.

---

## Code Sample

[`showcase-code/responder-classification.js`](showcase-code/responder-classification.js) is a standalone, rewritten extraction of step 3 above — decoupled from the app's internal state shape and Drive sync code, with example usage included. It implements:

- `estimateE1rm(weightKg, reps)` — Epley-formula 1RM estimation
- `classifyResponderStatus(sets)` — month-over-month strength trend, high/low responder threshold
- `estimateExpectedGainCap(trainingAgeMonths)` — realistic gain ceiling by training age

Run it directly: `node showcase-code/responder-classification.js`

**Scientific basis**: Grgic et al. (2017) and Schoenfeld (2010) on hypertrophy/strength dose-response; Zourdos et al. (2016) on RPE-based autoregulation; well-documented individual variability in resistance-training response (responders vs. low-responders).

---

## Other things this product handles (not detailed here)

- Google OAuth login flow with token refresh and offline support
- Bidirectional Drive sync with conflict resolution (local vs. remote state merge)
- Photo upload with Drive file-ID caching to avoid duplicate uploads
- A PRO tier gated through a payment webhook (Buy Me a Coffee), tracked via expiry date
- Full bilingual UI (~170 exercises, EN/ES) with alias resolution for gym slang

---

## Contact

Built and maintained by me, solo. Happy to walk through any part of this in more depth.
