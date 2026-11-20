#!/usr/bin/env python3
"""Add the `priority` field to an existing fiksdet_tasks collection. Idempotent.

    python tools/add_priority_field.py

Priority is a whole number: 1 = Haster, 0 = Normal, -1 = Kan vente. Existing
records read as 0 (PocketBase numbers are 0 when absent), so every task
already on the list lands in Normal. Safe to run against the live list.

Run this BEFORE deploying the frontend that sets priority. PocketBase quietly
ignores body keys it doesn't know, so without the field the app would look
like it saved a priority and then lose it on the next reload.
"""

from pb import connect

FIELD = {"type": "number", "name": "priority", "onlyInt": True, "min": -1, "max": 1}


def main():
    pb, _ = connect()

    coll = pb.collection("fiksdet_tasks")
    if coll is None:
        raise SystemExit("fiksdet_tasks does not exist -- run tools/create_collection.py first")

    fields = coll["fields"]
    if any(f.get("name") == FIELD["name"] for f in fields):
        print("ok       fiksdet_tasks.priority (already present)")
        return

    # PATCH replaces the whole field list rather than merging into it, so the
    # existing fields go back verbatim, ids and all, with the new one appended.
    # Anything omitted here would drop its column and its data with it.
    pb.req("PATCH", f"/api/collections/{coll['id']}", {"fields": fields + [FIELD]})
    print("PATCHED  fiksdet_tasks  (+ priority)")


if __name__ == "__main__":
    main()
