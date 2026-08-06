#!/usr/bin/env python3
"""(Re)apply fiksdet_tasks' access rules. Idempotent.

list/view/create/update are open ("") on purpose -- Svo chose no login for
this app, so mom's phone (and anyone else's) talks to PocketBase anonymously.
delete is locked to superusers only (null), so nobody can wipe the list from
the app itself, even by accident. See the README for the full rationale.

Does NOT create the collection if it's missing -- run
tools/create_collection.py first. Kept separate on purpose, same reasoning
as anvil/tools/set_rules.py: a rule-tightening script should never also be
the thing that can silently create a collection.

    python tools/set_rules.py
"""

from pb import connect

RULES = {
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": None,
}


def describe(v):
    return "open" if v == "" else "superuser-only" if v is None else v


def main():
    pb, _ = connect()

    coll = pb.collection("fiksdet_tasks")
    if coll is None:
        raise SystemExit("fiksdet_tasks does not exist -- run tools/create_collection.py first")

    current = {k: coll.get(k) for k in RULES}
    if current == RULES:
        print("ok       fiksdet_tasks (rules already correct)")
        return

    was = ", ".join(f"{k[:-4]}={describe(v)}" for k, v in current.items() if v != RULES[k])
    pb.req("PATCH", f"/api/collections/{coll['id']}", RULES)
    print(f"PATCHED  fiksdet_tasks  (was: {was})")


if __name__ == "__main__":
    main()
