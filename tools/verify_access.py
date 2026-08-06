#!/usr/bin/env python3
"""Prove fiksdet_tasks' access rules match intent. Idempotent -- creates and
cleans up one probe record (cleanup runs as superuser, since anonymous
delete is refused by design).

    python tools/verify_access.py

Unlike anvil/tools/verify_access.py -- which proves writes are REFUSED --
this one proves the opposite: list/create/update should succeed anonymously
(no login, by design), and only delete should be refused. PocketBase does
NOT return 403 on a blocked list, it returns 200 with an empty items array,
so the checks that matter are the write outcomes, not read status codes
alone.
"""

import json
import urllib.error
import urllib.request

from pb import connect

BASE = "/api/collections/fiksdet_tasks/records"
PROBE_TITLE = "__verify_access_probe__"

results = []


def check(label, ok, detail=""):
    results.append(ok)
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{'  -- ' + detail if detail else ''}")


def anon_req(base, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{base}{path}", data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, None


def main():
    pb, env = connect()  # superuser -- used only for cleanup, not for the probes below
    base = env.get("PB_URL", "https://pb.aetheriumforge.cloud").rstrip("/")

    print("1. Anonymous list works")
    status, _ = anon_req(base, "GET", f"{BASE}?perPage=1")
    check("GET fiksdet_tasks", status == 200, f"HTTP {status}")

    print("\n2. Anonymous create works")
    status, body = anon_req(base, "POST", BASE, {"title": PROBE_TITLE, "note": "", "done": False})
    probe_id = body["id"] if status < 400 and body else None
    check("POST fiksdet_tasks", status < 400 and probe_id is not None, f"HTTP {status}")

    if probe_id:
        print("\n3. Anonymous update works")
        status, _ = anon_req(base, "PATCH", f"{BASE}/{probe_id}", {"done": True})
        check("PATCH fiksdet_tasks", status < 400, f"HTTP {status}")

        print("\n4. Anonymous delete is refused (the check that actually proves it)")
        status, _ = anon_req(base, "DELETE", f"{BASE}/{probe_id}")
        check("DELETE fiksdet_tasks", status >= 400, f"HTTP {status}")
        if status < 400:
            print("       !! The probe was deleted anonymously. Re-run set_rules.py.")

        print("\n5. Cleanup (superuser removes the probe record)")
        try:
            pb.req("DELETE", f"{BASE}/{probe_id}")
            check("superuser cleanup", True)
        except RuntimeError as e:
            check("superuser cleanup", False, str(e)[:120])
    else:
        print("\n(skipping update/delete checks -- no probe record to test against)")

    failed = results.count(False)
    print(f"\n{'ALL PASS' if not failed else str(failed) + ' FAILED'}  ({len(results)} checks)")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
