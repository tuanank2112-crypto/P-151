"""Load demo data for one building from seed/ (locations, shifts, playbooks)."""

import csv
from pathlib import Path

import yaml
from sqlmodel import Session, select

from src.models.entities import Location, Playbook, Shift

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"


def _blank_to_none(value: str) -> str | None:
    return value.strip() or None


def seed_if_empty(session: Session, seed_dir: Path = SEED_DIR) -> bool:
    """Insert seed data when the catalog is empty. Returns True if data was inserted."""
    if session.exec(select(Location)).first() is not None:
        return False

    with open(seed_dir / "locations.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            floor = _blank_to_none(row["floor"])
            session.add(
                Location(
                    id=row["id"],
                    building=row["building"],
                    floor=int(floor) if floor is not None else None,
                    area=row["area"],
                    unit=_blank_to_none(row["unit"]),
                    name=row["name"],
                )
            )

    with open(seed_dir / "shifts.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            session.add(
                Shift(
                    technician_id=row["technician_id"],
                    technician_name=row["technician_name"],
                    zalo_chat_id=_blank_to_none(row["zalo_chat_id"]),
                    skill=row["skill"],
                    building=row["building"],
                    days=row["days"],
                    start=row["start"],
                    end=row["end"],
                )
            )

    with open(seed_dir / "playbook.yaml", encoding="utf-8") as f:
        for category, pb in yaml.safe_load(f).items():
            session.add(Playbook(category=category, **pb))

    session.commit()
    return True
