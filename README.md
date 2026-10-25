---
created: 2026-10-25
---

# Finance

What the brain spends, on one page, read-only.

## What it shows

- **Fixed per month**: every monthly line (box rent, storage, snapshots) with provider, rate and since, and the total.
- **This week per post**: each staffed post against its weekly cap as a bar, last week as a tick, and the state. A post at `HALT-<post>` is drawn full and tagged; the line under the list says how many are halted.
- **Running compute**: anything billed by the hour right now, with hours and euros so far. Empty is the good state.
- **Last lines**: the last ten ledger lines (date, kind, note, euros).
- **Harmonics**: how many of those lines carry a harmonics figure. Harmonics are measured, never bought, so no euro stands beside them.
- A footer with the file's `generated_at` and where the data came from. **Refresh** reads the file again.

It writes nothing: no memory, no model calls, no permissions in the manifest.

## Data source

One file in the world, `ops/finance/finance.json`, written every 10 minutes by `scripts/finance.py`. The app reads the spec names and the names the script writes (`per_month` + `currency`, `weekly_cap_eur`, `this_week_eur`, `last_week_eur`, `so_far`, `fixed_eur_per_month`, `variable_this_week_eur`, the `harmonics` and `windows` objects). Spec keys: `fixed[]` (item, provider, rate, since, eur_month), `variable_by_post[]` (post, cap_eur, spent_week_eur, spent_last_week_eur, state), `running[]` (item, rate, hours, eur_so_far), `last10[]` (date, item, kind, eur, note), `totals{fixed_month_eur, variable_week_eur, variable_last_week_eur}`, `generated_at`.

The app tries, in order:

1. `./finance.json` beside the app (`brain-apps/finance/finance.json` on the brain). The app lane lets an app read its own files, so a copy placed there by the box works on every console. The Apps Update swaps the directory, so the copy has to be re-placed after an update.
2. `/cc/files/raw/home/hands/world/ops/finance/finance.json`, the console's raw file route on the same host. Consoles since 2026-10-16 answer app frames with `403 app_frame_refused` on `/cc`, so this works only on a console that opens that route to apps.
3. The last copy kept on this device (the app's own storage).
4. A file you drop (**Load a file**), kept on this device.

The file is never part of this repo (`.gitignore`).

## Install

1. hbar creates the public repo `hbar-systems/brain-app-finance` on GitHub and adds the line `hbar-systems/brain-app-finance` to `/home/pusher/etc/allow.txt` on the box (`sudo nano /home/pusher/etc/allow.txt`).
2. Push `main` through the push helper.
3. On the brain, open Apps, install from `https://github.com/hbar-systems/brain-app-finance`; there are no permissions to approve.
4. Open Finance from the tab bar. Power-user path: clone into `brain-apps/finance/` on the brain and `POST /apps/install {"path": "brain-apps/finance"}`.

Needs a brain at brainfoundry-nous 0.13.0 or later.

## Check

```
python3 kit/check.py .
```

The kit is vendored from `brain-app-kit` 0.1.0 (`kit/bf-kit.js`, `kit/bf-kit.css`, `kit/check.py`).
