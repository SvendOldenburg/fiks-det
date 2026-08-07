#!/usr/bin/env python3
"""Add the `deleted` flag to an existing fiksdet_tasks collection. Idempotent.

The app's delete button deletes softly -- it PATCHes `deleted = true` rather
than issuing a DELETE. That keeps deleteRule superuser-only (the one guardrail
on an otherwise open, no-login collection) while still giving the list a
working delete button, and it means a mis-tap is recoverable from the
PocketBase admin UI instead of gone.

    python tools/add_deleted_field.py

Only needed for collections created before the flag existed --
tools/create_collection.py now includes it. Existing records read as
`deleted = false` (PocketBase bools are false when absent), so this is safe
to run against a live list.
"""

from pb import connect

FIELD = {"type": "bool", "name": "deleted"}


def main():
    pb, _ = connect()

    coll = pb.collection("fiksdet_tasks")
    if coll is None:
        raise SystemExit("fiksdet_tasks does not exist -- run tools/create_collection.py first")

    fields = coll["fields"]
    if any(f.get("name") == FIELD["name"] for f in fields):
        print("ok       fiksdet_tasks.deleted (already present)")
        return

    # PATCH replaces the whole field list rather than merging into it, so the
    # existing fields go back verbatim, ids and all, with the new one appended.
    # Anything omitted here would drop its column and its data with it.
    pb.req("PATCH", f"/api/collections/{coll['id']}", {"fields": fields + [FIELD]})
    print("PATCHED  fiksdet_tasks  (+ deleted)")


if __name__ == "__main__":
    main()
