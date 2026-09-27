"""Shared API dependencies. No real auth yet: the X-Role header simulates who is calling."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from src.db import get_session

SessionDep = Annotated[Session, Depends(get_session)]


def require_role(*allowed: str):
    def dependency(
        x_role: Annotated[str | None, Header(description=f"Vai trò giả lập: {' | '.join(allowed)}")] = None,
    ) -> str:
        if x_role not in allowed:
            raise HTTPException(status_code=403, detail=f"Cần header X-Role là {' hoặc '.join(allowed)}")
        return x_role

    return dependency


BQL = Annotated[str, Depends(require_role("bql"))]
Technician = Annotated[str, Depends(require_role("technician"))]
BQLOrTechnician = Annotated[str, Depends(require_role("bql", "technician"))]
