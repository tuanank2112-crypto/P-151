from fastapi import APIRouter

from src.api.deps import BQL, SessionDep
from src.services.metrics import Metrics, compute_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("", response_model=Metrics)
def read_metrics(session: SessionDep, _role: BQL) -> Metrics:
    """Thời gian từ ticket đến giao việc (trung vị), tỷ lệ hồ sơ đạt lần đầu, số ngoại lệ."""
    return compute_metrics(session)
