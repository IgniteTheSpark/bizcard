"""
GET  /api/contacts        — list contacts
GET  /api/contacts/{id}   — single contact
"""
from fastapi import APIRouter, Query
from sqlalchemy import select
from typing import Optional

from db.models import Contact
from db.database import AsyncSessionLocal
import uuid

router = APIRouter()


@router.get("/contacts")
async def list_contacts(
    q: Optional[str] = Query(None, description="Name search"),
    limit: int = Query(50, le=200),
):
    async with AsyncSessionLocal() as db:
        stmt = select(Contact).where(Contact.user_id == "default")
        if q:
            stmt = stmt.where(Contact.name.ilike(f"%{q}%"))
        stmt = stmt.order_by(Contact.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        contacts = result.scalars().all()

    return {
        "ok": True,
        "contacts": [
            {
                "id": str(c.id),
                "name": c.name,
                "phone": c.phone,
                "company": c.company,
                "title": c.title,
                "email": c.email,
                "notes": c.notes,
                "created_at": c.created_at.isoformat(),
            }
            for c in contacts
        ],
    }


@router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Contact).where(
                Contact.id == uuid.UUID(contact_id),
                Contact.user_id == "default",
            )
        )
        c = result.scalar_one_or_none()
    if not c:
        return {"ok": False, "error": "Not found"}
    return {
        "ok": True,
        "contact": {
            "id": str(c.id),
            "name": c.name,
            "phone": c.phone,
            "company": c.company,
            "title": c.title,
            "email": c.email,
            "notes": c.notes,
            "created_at": c.created_at.isoformat(),
        },
    }
