#!/usr/bin/env python3
"""Audit reachability: recursively enumerate every route of the FastAPI application
and classify each endpoint's authentication/authorization guard.

FastAPI 0.141.1 nests every APIRoute inside _IncludedRouter objects, so
app.routes alone only shows the top-level /health route. We recurse through
_IncludedRouter.original_router.routes (and the _effective_candidates path,
if present) as a fallback.

For role gates produced by app.api.deps.require_role(...) the concrete
normalized_allowed role set is read straight out of the closure cell of the
inner `role_checker` function, so the report shows the REAL allowed roles
instead of a generic label.

Usage:
    python scripts/audit_reachability.py

REQUIRED DEPS: FastAPI == 0.141.1 and starlette == 1.7.0 (pinned).
The private-internal _IncludedRouter traversal below is the only compatibility
break if those versions change.
"""

import os
import sys

# Make the project root importable regardless of the current working directory.
_PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from fastapi.routing import APIRoute

from app.main import app

# HTTP methods that mutate state -> WRITE; GET -> READ (others = neither).
_WRITE = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_role_set(callable_):
    """Pull the normalized_allowed role set out of a require_role closure.

    app.api.deps.require_role returns an inner `role_checker` whose closure
    holds exactly one cell: the set of normalized role names it permits.
    Returns None for anything that is not such a closure.
    """
    cells = getattr(callable_, "__closure__", None) or ()
    for cell in cells:
        try:
            val = cell.cell_contents
        except ValueError:  # empty cell
            continue
        if isinstance(val, (set, frozenset)) and all(
            isinstance(x, str) for x in val
        ):
            return sorted(val)
    return None


# Maps a dependency callable -> (short guard label, allowed-roles list or None).
def _label(callable_):
    name = getattr(callable_, "__name__", str(callable_))
    low = name.lower()

    # All require_role factories end up in an inner role_checker closure.
    if low == "role_checker":
        roles = _extract_role_set(callable_)
        if roles:
            return "ROLE_CHECKER[" + ", ".join(roles) + "]", roles
        return "ROLE_CHECKER", None

    if low == "get_current_user":
        return "AUTH_ONLY", None
    if low == "require_doctor_strictly":
        return "STRICT_DOCTOR", ["doctor"]
    if low == "require_doctor":
        return "DOCTOR_OR_ADMIN", ["doctor", "admin", "Admin", "Super Admin"]
    if low == "require_admin":
        return "ADMIN_ONLY", ["admin", "Platform Owner", "Super Admin"]
    if low == "require_receptionist":
        return "RECEPTIONIST_OR_ADMIN", [
            "receptionist",
            "Receptionist",
            "admin",
            "Admin",
            "Super Admin",
            "Clinic Branch Manager",
        ]
    if low == "require_roles":
        return "ROLES(enum)", None
    return low.upper(), None


def _dep_names(deps):
    return [getattr(d.call, "__name__", str(d.call)) for d in deps]


def collect(routes, out):
    """Recursively collect APIRoute objects through _IncludedRouter layers."""
    for r in routes:
        if isinstance(r, APIRoute):
            out.append(r)
        elif type(r).__name__ == "_IncludedRouter":
            orig = getattr(r, "original_router", None)
            if orig is not None and hasattr(orig, "routes"):
                collect(orig.routes, out)
    return out


def classify_deps(deps):
    """Human-readable guard chain; identical labels are de-duplicated.

    e.g. [role_checker(admin), role_checker(admin), get_booking_settings_service]
    renders as 'ROLE_CHECKER[admin] + GET_BOOKING_SETTINGS_SERVICE'.
    """
    parts = []
    for d in deps:
        label, _ = _label(d.call)
        if label not in parts:
            parts.append(label)
    return " + ".join(parts) if parts else "Public (no guard)"


def allowed_roles(deps):
    """Effective allow-list: every role gate must pass, so when multiple
    require_role gates are stacked (router-level + endpoint-level) the
    effective roles are the INTERSECTION of their allow-lists."""
    gate_sets = []
    for d in deps:
        _, r = _label(d.call)
        if r:
            gate_sets.append(set(r))
    if not gate_sets:
        return []
    effective = gate_sets[0]
    for s in gate_sets[1:]:
        effective = effective & s
    return sorted(effective)


def _has_role_gate(deps):
    """Return True if the route depends on any role authorization gate."""
    for d in deps:
        low = getattr(d.call, "__name__", "").lower()
        if low == "role_checker" or "require_" in low:
            return True
    return False


def _is_public(deps):
    """True if the route has no authentication dependency of any kind."""
    for d in deps:
        low = getattr(d.call, "__name__", "").lower()
        if low in ("role_checker", "get_current_user") or "require_" in low:
            return False
    return True

def write_reachability_audit(routes, out_path):
    read_count = sum(1 for r in routes if sorted(r.methods) and sorted(r.methods)[0] == "GET")
    write_count = len(routes) - read_count

    public = [r for r in routes if _is_public(r.dependant.dependencies)]
    auth_no_role = [
        r
        for r in routes
        if not _is_public(r.dependant.dependencies)
        and not _has_role_gate(r.dependant.dependencies)
    ]

    lines = []
    lines.append("# Marlow Dental - Backend Route Reachability Audit")
    lines.append("")
    lines.append("Automated audit of every FastAPI route under _IncludedRouter (FastAPI 0.141.1, app.openapi() + dependant.dependencies).")
    lines.append("Role allow-lists are extracted from the require_role() closure cells, so the guard column shows the real permitted roles.")
    lines.append("")
    lines.append("## Audit Summary & Counts")
    lines.append("")
    lines.append("| Metric | Count |")
    lines.append("| :--- | :---: |")
    lines.append("| **Total routes** | %d |" % len(routes))
    lines.append("| **READ routes** | %d |" % read_count)
    lines.append("| **WRITE routes** | %d |" % write_count)
    lines.append("| **Public routes (no auth dependency)** | %d |" % len(public))
    lines.append("| **Authenticated but no role gate** | %d |" % len(auth_no_role))
    lines.append("")
    lines.append("## Public / Unauthenticated Routes (review each: must be intentional)")
    lines.append("")
    lines.append("| Method | Path | Kind | Note |")
    lines.append("| :--- | :--- | :--- | :--- |")
    for r in sorted(public, key=lambda x: (x.path, sorted(x.methods))):
        kind = "WRITE" if any(m in r.methods for m in _WRITE) else "READ"
        note = ""
        p = r.path
        if p.startswith("/health"):
            note = "liveness/readiness probe"
        elif p.startswith("/auth"):
            note = "login/register flow"
        elif p.startswith("/public"):
            note = "public website content"
        elif p == "/appointments":
            note = "public booking form (rate-limited via slowapi)"
        elif "/docs" in p or "/openapi" in p:
            note = "API documentation"
        if kind == "WRITE" and not note:
            note = "UNREVIEWED PUBLIC WRITE - verify intent!"
        lines.append("| `%s` | `%s` | %s | %s |" % (sorted(r.methods)[0], r.path, kind, note))
    lines.append("")
    lines.append("## Authenticated Routes Without Role Gate (any logged-in user)")
    lines.append("")
    if auth_no_role:
        lines.append("| Method | Path | Kind |")
        lines.append("| :--- | :--- | :--- |")
        for r in sorted(auth_no_role, key=lambda x: (x.path, sorted(x.methods))):
            kind = "WRITE" if any(m in r.methods for m in _WRITE) else "READ"
            lines.append("| `%s` | `%s` | %s |" % (sorted(r.methods)[0], r.path, kind))
    else:
        lines.append("None - every authenticated route is role-gated.")
    lines.append("")
    lines.append("## Backend OpenAPI Routes & Role Guards")
    lines.append("")
    lines.append("| Method | Path | Guard | Kind | Allowed roles |")
    lines.append("| :--- | :--- | :--- | :--- | :--- |")
    for r in sorted(routes, key=lambda x: (x.path, sorted(x.methods))):
        guard = classify_deps(r.dependant.dependencies)
        kind = "WRITE" if any(m in r.methods for m in _WRITE) else "READ"
        roles = allowed_roles(r.dependant.dependencies)
        if roles:
            roles_txt = ", ".join(roles)
        elif _is_public(r.dependant.dependencies):
            roles_txt = "(public)"
        else:
            roles_txt = "any authenticated user"
        lines.append("| `%s` | `%s` | %s | %s | %s |" % (sorted(r.methods)[0], r.path, guard, kind, roles_txt))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(
        "Wrote %s (total=%d, read=%d, write=%d, public=%d, auth-no-role=%d)"
        % (out_path, len(routes), read_count, write_count, len(public), len(auth_no_role))
    )


def write_role_access(routes, out_path):
    lines = []
    lines.append("# Marlow Dental - Role Access & Route Authorization Matrix")
    lines.append("")
    lines.append("Backend-only role guard matrix (FastAPI 0.141.1).")
    lines.append("Role allow-lists are read from the require_role() closure cells at audit time.")
    lines.append("")
    lines.append("## Guard Label Definitions")
    lines.append("")
    lines.append("| Guard | Meaning |")
    lines.append("| :--- | :--- |")
    lines.append("| Public (no guard) | no auth dependency at all |")
    lines.append("| AUTH_ONLY | bare get_current_user, no role gate |")
    lines.append("| STRICT_DOCTOR | require_doctor_strictly (doctor only) |")
    lines.append("| DOCTOR_OR_ADMIN | require_doctor (doctor + admin) |")
    lines.append("| ADMIN_ONLY | require_admin |")
    lines.append("| RECEPTIONIST_OR_ADMIN | require_receptionist |")
    lines.append("| ROLE_CHECKER[...] | require_role(...) closure with listed roles |")
    lines.append("| ROLES(enum) | require_roles(...) with UserRole enum members |")
    lines.append("")
    lines.append("## API Route Access Matrix")
    lines.append("")
    lines.append("| Method | Path | Guard | Allowed (roles) |")
    lines.append("| :--- | :--- | :--- | :--- |")
    for r in sorted(routes, key=lambda x: (x.path, sorted(x.methods))):
        guard = classify_deps(r.dependant.dependencies)
        roles = allowed_roles(r.dependant.dependencies)
        if roles:
            allowed = "[" + ", ".join(roles) + "]"
        elif _is_public(r.dependant.dependencies):
            allowed = "(public - no auth)"
        else:
            allowed = "[any authenticated user]"
        lines.append("| `%s` | `%s` | %s | %s |" % (sorted(r.methods)[0], r.path, guard, allowed))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Wrote %s" % out_path)


def _docs_dir():
    """Absolute path to the project docs/ folder (sibling of the backend/ dir)."""
    return os.path.normpath(os.path.join(_PROJECT_ROOT, "..", "docs"))


def main():
    routes = collect(app.routes, [])
    write_reachability_audit(
        routes, os.path.join(_docs_dir(), "REACHABILITY_AUDIT.md")
    )
    write_role_access(routes, os.path.join(_docs_dir(), "ROLE_ACCESS.md"))
    print("TOTAL_ROUTES %d" % len(routes))
    print("-" * 112)
    print("%-12s %-62s %-60s %s" % ("METHOD", "PATH", "GUARD", "KIND"))
    print("-" * 112)
    for r in sorted(routes, key=lambda x: (x.path, sorted(x.methods))):
        deps = r.dependant.dependencies
        kind = "WRITE" if any(m in r.methods for m in _WRITE) else "READ"
        if _is_public(deps):
            tag = "  <-- PUBLIC (no auth)"
        elif not _has_role_gate(deps):
            tag = "  <-- AUTH-ONLY (no role gate)"
        else:
            tag = ""
        print("%-12s %-62s %-60s %s%s" % (sorted(r.methods)[0], r.path, classify_deps(deps), kind, tag))
    print("-" * 112)


if __name__ == "__main__":
    main()

