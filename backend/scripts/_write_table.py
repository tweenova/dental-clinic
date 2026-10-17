#!/usr/bin/env python3
"""Print WRITE-route table + effective-role counts using audit_reachability logic."""
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit_reachability as ar

ROLES = [
    "admin",
    "doctor",
    "receptionist",
    "nurse",
    "Platform Owner",
    "Super Admin",
    "Clinic Branch Manager",
    "Lab Technician",
    "Pharmacist",
    "Patient",
]


def handler_role_check(route):
    """Find in-handler role-check lines -> 'file:line'. None if absent."""
    try:
        src, start = inspect.getsourcelines(route.endpoint)
    except (OSError, TypeError):
        return None
    fname = inspect.getsourcefile(route.endpoint) or "?"
    hits = []
    for i, line in enumerate(src):
        low = line.lower()
        if (
            "current_user.role" in low
            or "user.role" in low
            or ".role ==" in low
            or ".role in" in low
            or "require_role" in low
            or "role.value" in low
        ):
            hits.append("%s:%d" % (os.path.relpath(fname), start + i))
    return ", ".join(hits) if hits else None


def main():
    routes = ar.collect(ar.app.routes, [])
    writes = [
        r
        for r in routes
        if any(m in r.methods for m in ar._WRITE)
    ]
    writes.sort(key=lambda r: (r.path, sorted(r.methods)))

    out = []
    out.append("=" * 140)
    out.append("WRITE ROUTES: method | path | effective allowed roles | in-handler role check (no-gate routes only)")
    out.append("=" * 140)
    counts = {}
    for r in writes:
        deps = r.dependant.dependencies
        roles = ar.allowed_roles(deps)
        eff = "[" + ", ".join(roles) + "]" if roles else "(NO ROLE GATE)"
        key = tuple(roles) if roles else ("<no role gate>",)
        counts[key] = counts.get(key, 0) + 1
        check = ""
        if not ar._has_role_gate(deps):
            rc = handler_role_check(r)
            check = rc or "none"
        out.append("%-7s %-70s %-45s %s" % (sorted(r.methods)[0], r.path, eff, check))

    out.append("")
    out.append("=" * 140)
    out.append("COUNTS BY EFFECTIVE-ROLE SET (WRITE routes, total=%d)" % len(writes))
    out.append("=" * 140)
    for key in sorted(counts, key=lambda k: (-counts[k], k)):
        label = ", ".join(key) if key != ("<no role gate>",) else "<no role gate>"
        out.append("%-70s %d" % (label, counts[key]))

    text = "\n".join(out)
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_table.txt"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    main()
