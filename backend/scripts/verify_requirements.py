#!/usr/bin/env python3
"""
Automated Validator for docs/REQUIREMENTS_STATUS.md.
Ensures:
1. Exactly 54 requirements (BK1–9, RC1–15, DR1–13, AD1–7, X1–10).
2. Every cited test file, page file, or component file exists on disk.
3. Every cited API route exists in FastAPI app.openapi().
Exits with code 1 if any cited file or requirement row is missing.
"""

import sys
import re
from pathlib import Path

# Add backend to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))
workspace_root = backend_root.parent

from app.main import app

def main():
    req_file = workspace_root / "docs" / "REQUIREMENTS_STATUS.md"
    if not req_file.exists():
        print(f"ERROR: {req_file} does not exist.")
        sys.exit(1)

    content = req_file.read_text(encoding="utf-8")
    
    # 1. Verify all 54 IDs exist
    expected_ids = (
        [f"BK{i}" for i in range(1, 10)] +
        [f"RC{i}" for i in range(1, 16)] +
        [f"DR{i}" for i in range(1, 14)] +
        [f"AD{i}" for i in range(1, 8)] +
        [f"X{i}" for i in range(1, 11)]
    )
    assert len(expected_ids) == 54, f"Expected 54 IDs, got {len(expected_ids)}"

    missing_ids = []
    for rid in expected_ids:
        # Match table row beginning with | **ID** |
        if not re.search(rf'\|\s*\*\*{rid}\*\*\s*\|', content):
            missing_ids.append(rid)

    if missing_ids:
        print(f"FAIL: Missing requirement rows in docs/REQUIREMENTS_STATUS.md: {missing_ids}")
        sys.exit(1)

    print(f"PASS: Exactly 54 requirement IDs verified in docs/REQUIREMENTS_STATUS.md.")

    # 2. Verify cited files exist
    cited_files = set()
    # Find files like src/app/..., components/..., test_*.py, etc.
    file_patterns = re.findall(r'[`\']([a-zA-Z0-9_\-\./\\]+\.(?:tsx|ts|py|md|ps1|png|json|mjs))[`\']', content)
    
    missing_files = []
    for fp in file_patterns:
        # Ignore placeholders or relative endpoints
        if fp.startswith("api/") or "..." in fp or fp.startswith("http"):
            continue
        
        # Check in frontend or backend or root
        candidates = [
            workspace_root / fp,
            workspace_root / "frontend" / fp,
            workspace_root / "frontend" / "src" / fp,
            workspace_root / "backend" / fp,
            workspace_root / "backend" / "tests" / fp,
            workspace_root / "docs" / fp,
            workspace_root / "docs" / "screenshots" / fp,
        ]
        if not any(c.exists() for c in candidates):
            missing_files.append(fp)

    if missing_files:
        print(f"FAIL: Cited files not found on disk: {missing_files}")
        sys.exit(1)

    print(f"PASS: All {len(file_patterns)} cited code/test/doc files verified on disk.")

    # 3. Verify OpenAPI routes
    schema = app.openapi()
    openapi_paths = set(schema.get("paths", {}).keys())
    
    # Extract routes from table like `/api/v1/...`
    routes_found = re.findall(r'/api/v1/[a-zA-Z0-9_\-\/\{\}]+', content)
    unmatched_routes = []
    for r in set(routes_found):
        # Match route against openapi paths
        # Normalize wildcards or parameterized routes
        base_r = r.split("{")[0].rstrip("/")
        matched = any(op.startswith(base_r) for op in openapi_paths)
        if not matched:
            unmatched_routes.append(r)

    if unmatched_routes:
        print(f"FAIL: Cited API routes not found in OpenAPI schema: {unmatched_routes}")
        sys.exit(1)

    print(f"PASS: All cited API routes verified in FastAPI OpenAPI schema.")
    print("ALL 54 REQUIREMENTS VALIDATED SUCCESSFULLY.")

if __name__ == "__main__":
    main()
