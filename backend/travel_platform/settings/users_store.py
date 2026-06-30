"""Platform users — in-memory (wire to Postgres platform_users in production)."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

UserRole = Literal["admin", "driver", "agent", "viewer"]


@dataclass
class PlatformUser:
    id: str
    email: str
    name: str
    role: UserRole
    password_hash: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


def _hash_password(password: str) -> str:
    salt = "aerostride-dev-salt"
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()


def _seed_users() -> dict[str, PlatformUser]:
    now = datetime.now(timezone.utc)
    seeds = [
        ("admin@aerostride.com", "Admin User", "admin", "admin123"),
        ("driver@aerostride.com", "Driver User", "driver", "driver123"),
        ("agent@aerostride.com", "Μαρία Agent", "agent", "agent123"),
        ("viewer@aerostride.com", "Read Only", "viewer", "viewer123"),
    ]
    users: dict[str, PlatformUser] = {}
    for email, name, role, pwd in seeds:
        uid = str(uuid4())
        users[uid] = PlatformUser(
            id=uid,
            email=email,
            name=name,
            role=role,
            password_hash=_hash_password(pwd),
            is_active=True,
            created_at=now,
        )
    return users


_users: dict[str, PlatformUser] | None = None


def _ensure() -> dict[str, PlatformUser]:
    global _users
    if _users is None:
        _users = _seed_users()
    return _users


def list_users() -> list[PlatformUser]:
    return sorted(_ensure().values(), key=lambda u: u.email)


def get_user(user_id: str) -> PlatformUser | None:
    return _ensure().get(user_id)


def create_user(
    *,
    email: str,
    name: str,
    role: UserRole,
    password: str | None = None,
) -> PlatformUser:
    email_l = email.strip().lower()
    for u in _ensure().values():
        if u.email == email_l:
            raise ValueError("Email already exists")
    uid = str(uuid4())
    pwd = password or secrets.token_urlsafe(12)
    user = PlatformUser(
        id=uid,
        email=email_l,
        name=name.strip(),
        role=role,
        password_hash=_hash_password(pwd),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    _ensure()[uid] = user
    return user


def update_user(user_id: str, patch: dict) -> PlatformUser:
    user = _ensure().get(user_id)
    if not user:
        raise KeyError("User not found")
    if "name" in patch and patch["name"] is not None:
        user.name = patch["name"].strip()
    if "role" in patch and patch["role"] is not None:
        user.role = patch["role"]
    if "is_active" in patch and patch["is_active"] is not None:
        user.is_active = patch["is_active"]
    if patch.get("password"):
        user.password_hash = _hash_password(patch["password"])
    return user


def delete_user(user_id: str) -> None:
    users = _ensure()
    user = users.get(user_id)
    if not user:
        raise KeyError("User not found")
    if user.role == "admin" and sum(1 for u in users.values() if u.role == "admin" and u.is_active) <= 1:
        raise ValueError("Cannot delete the last active admin")
    del users[user_id]


def replace_users_from_backup(data: list[dict]) -> int:
    global _users
    _users = {}
    count = 0
    for row in data:
        uid = row.get("id") or str(uuid4())
        _users[uid] = PlatformUser(
            id=uid,
            email=row["email"].lower(),
            name=row["name"],
            role=row.get("role", "viewer"),
            password_hash=row.get("password_hash") or _hash_password("changeme"),
            is_active=bool(row.get("is_active", True)),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            if isinstance(row.get("created_at"), str)
            else datetime.now(timezone.utc),
            last_login_at=None,
        )
        count += 1
    return count


def users_for_export() -> list[dict]:
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "password_hash": u.password_hash,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in list_users()
    ]
