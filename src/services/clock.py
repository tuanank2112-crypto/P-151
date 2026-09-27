"""Single source of "now" so tests can freeze or move time."""

from datetime import datetime, timedelta, timezone

# Vietnam has no DST, so a fixed offset avoids needing tzdata on Windows
VN_TZ = timezone(timedelta(hours=7), name="Asia/Ho_Chi_Minh")


def now() -> datetime:
    """Current local time (Asia/Ho_Chi_Minh) as a naive datetime, as stored in the DB."""
    return datetime.now(VN_TZ).replace(tzinfo=None)
