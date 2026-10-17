# FINISH_CHECKLIST.md

STEP 0 | DONE | alembic downgrade base && upgrade head && python -m app.cli doctor (10/10 PASS) && python -m pytest backend/tests/test_scripted_visit_e2e.py -q (1 passed) && npx playwright test (4 passed)
STEP 1 | DONE | npx playwright test tests/change-password.spec.ts tests/clinical-documents.spec.ts tests/note-templates.spec.ts (all passed)
STEP 2 | DONE | python -m alembic -c alembic.ini heads (c2d3e4f5a6b7 (head))
STEP 3 | DONE | python -m pytest backend/tests/test_clinical_write_403.py -q (211 passed, 0 failed)
