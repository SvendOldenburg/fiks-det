#!/usr/bin/env python3
"""Create the fiksdet_tasks PocketBase collection. Idempotent.

Single collection, no login (Svo's call -- see README). list/view/create/
update are open to anyone; delete is superuser-only, so nobody -- including
a stranger who finds the URL -- can wipe the list from the app itself.

    python tools/create_collection.py

Run this before tools/set_rules.py the first time (it also sets the rules
on create; set_rules.py exists separately to re-assert them later without
risking an accidental re-create).
"""

from pb import connect

RULES = {
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": None,
}


def autodates():
    return [
        {"type": "autodate", "name": "created", "onCreate": True},
        {"type": "autodate", "name": "updated", "onCreate": True, "onUpdate": True},
    ]


def main():
    pb, _ = connect()

    existing = pb.collection("fiksdet_tasks")
    if existing:
        pb.req("PATCH", f"/api/collections/{existing['id']}", RULES)
        print("= fiksdet_tasks exists (rules re-applied)")
        return

    spec = {
        "name": "fiksdet_tasks",
        "type": "base",
        "fields": [
            {"type": "text", "name": "title", "required": True, "presentable": True},
            {"type": "text", "name": "note"},
            {"type": "bool", "name": "done"},
        ] + autodates(),
        "indexes": [],
        **RULES,
    }
    pb.req("POST", "/api/collections", spec)
    print("+ fiksdet_tasks created")


if __name__ == "__main__":
    main()
