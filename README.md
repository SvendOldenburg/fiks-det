# Fiks det

A birthday gift for Svo's mom: a one-screen list where she logs things in
her apartment that need fixing, so the family can show up together and work
through it.

**Live:** https://svendoldenburg.com/fiks-det/

## Stack

- Vanilla JS ES modules, no framework, no build step. GitHub Pages off `master`.
- PocketBase (v0.37) at `pb.aetheriumforge.cloud` for all data.
- **No login.** See "Why the rules are open" below before assuming that's a bug.
- PWA: `manifest.json` + `sw.js` app-shell cache.

## Deploy

Push to `master`. GitHub Pages picks it up.

**Bump `CACHE` in `sw.js` on any frontend change.** The app shell is cached
cache-first; without a bump, returning visitors (including mom's installed
PWA) keep the old shell.

## Collection

`fiksdet_tasks` -- `title` (text, required), `note` (text, optional),
`done` (bool). Prefixed and distinctive on purpose, to stay clear of
Anvil's seven unprefixed collections and `vessel_*` / `lumen_*` / `meeple_*`.

## Why the rules are open

`listRule` / `viewRule` / `createRule` / `updateRule` are all `""` (public,
no auth required). This is **deliberate**, not an oversight -- flagging that
explicitly because Anvil's own collections sat open by accident for months
before anyone noticed (PocketBase returns 200 + empty results on a blocked
list, not 403, so it doesn't fail loudly).

The tradeoff was chosen on purpose: no login screen for mom, at the cost of
the list living on an unlisted GitHub Pages URL rather than behind real auth.
Anyone who found that URL could read the list or add clutter to it.

`deleteRule` is `null` (superuser-only) as the one piece of defense-in-depth
this doesn't give up: nobody, including a stranger who stumbles on the URL,
can wipe the list from the app itself. The app's UI has no delete button to
match.

## Gotchas

- **We don't sort by `created` server-side.** Anvil's README flags a
  PocketBase 0.37 quirk where `?sort=-created` 400s on some of its older
  collections. Rather than assume this fresh collection is affected, `js/api.js`
  just sorts client-side on the `created` field every record already carries
  in its JSON body -- simpler, and immune to the issue either way.
- No web fonts. `css/style.css` uses `system-ui` only, so there's nothing to
  fetch and nothing that fails to load offline (unlike Anvil's Google Fonts).

## Tools

```
python tools/gen_icons.py         # regenerate icons/ (pure stdlib, no deps)
python tools/create_collection.py # create fiksdet_tasks if missing (idempotent)
python tools/set_rules.py         # re-assert the rules above (idempotent)
python tools/verify_access.py     # prove they hold
```

Copy `tools/.env.example` to `tools/.env` first (needs a PocketBase superuser
login -- there's no app-level account to configure, since the app itself
doesn't log in).

## Dev

```
python -m http.server 8000
```

Then `http://localhost:8000`. No `?preview` needed -- there's no auth screen
to bypass.
