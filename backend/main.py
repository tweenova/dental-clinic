"""
Main application entry point proxy for Marlow Dental API.

Exposes the FastAPI instance `app` at the backend root level so standard ASGI
invocations such as `uvicorn main:app --reload` work seamlessly alongside
package invocations (`uvicorn app.main:app --reload`). Canonical definitions
and routes reside in `app.main`.
"""
import sys
from pathlib import Path

# Ensure the backend root directory is on sys.path
_BACKEND_ROOT = str(Path(__file__).resolve().parent)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.main import app  # noqa: E402

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
