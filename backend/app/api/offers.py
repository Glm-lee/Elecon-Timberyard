from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from ..api.auth import require_role
from ..database import get_db
from ..models.models import Offer, OfferItem, Product

router = APIRouter()


class OfferItemCreate(BaseModel):
    product_id: int
    offer_price: float = Field(..., gt=0)
    old_price: Optional[float] = Field(default=None, gt=0)
    is_active: bool = True


class OfferItemUpdate(BaseModel):
    offer_price: Optional[float] = Field(default=None, gt=0)
    old_price: Optional[float] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class OfferCreate(BaseModel):
    title: str
    badge: Optional[str] = None
    description: Optional[str] = None
    terms: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True


class OfferUpdate(BaseModel):
    title: Optional[str] = None
    badge: Optional[str] = None
    description: Optional[str] = None
    terms: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class OfferItemOut(BaseModel):
    id: int
    offer_id: int
    product_id: int
    offer_price: float
    old_price: Optional[float] = None
    is_active: bool
    created_at: datetime
    product_name: Optional[str] = None
    product_size: Optional[str] = None
    stock_quantity: Optional[int] = None
    regular_price: Optional[float] = None


class OfferOut(BaseModel):
    id: int
    title: str
    badge: Optional[str] = None
    description: Optional[str] = None
    terms: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: List[OfferItemOut] = []


def _to_item_out(item: OfferItem) -> OfferItemOut:
    product = item.product
    return OfferItemOut(
        id=item.id,
        offer_id=item.offer_id,
        product_id=item.product_id,
        offer_price=float(item.offer_price),
        old_price=float(item.old_price) if item.old_price is not None else None,
        is_active=bool(item.is_active),
        created_at=item.created_at,
        product_name=product.name if product else None,
        product_size=product.size if product else None,
        stock_quantity=product.stock_quantity if product else None,
        regular_price=float(product.price) if product and product.price is not None else None,
    )


def _to_offer_out(offer: Offer, now: datetime, admin_view: bool) -> Optional[OfferOut]:
    if not admin_view:
        if not offer.is_active:
            return None
        if offer.starts_at and offer.starts_at > now:
            return None
        if offer.ends_at and offer.ends_at < now:
            return None

    items: List[OfferItemOut] = []
    for item in sorted(offer.items, key=lambda x: x.id):
        if not admin_view and not item.is_active:
            continue
        if not item.product:
            continue
        items.append(_to_item_out(item))

    if not admin_view and not items:
        return None

    return OfferOut(
        id=offer.id,
        title=offer.title,
        badge=offer.badge,
        description=offer.description,
        terms=offer.terms,
        starts_at=offer.starts_at,
        ends_at=offer.ends_at,
        is_active=bool(offer.is_active),
        created_at=offer.created_at,
        updated_at=offer.updated_at,
        items=items,
    )


def _validate_offer_dates(starts_at: Optional[datetime], ends_at: Optional[datetime]):
    if starts_at and ends_at and ends_at < starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")


def _get_offer_or_404(db: Session, offer_id: int) -> Offer:
    offer = (
        db.query(Offer)
        .options(joinedload(Offer.items).joinedload(OfferItem.product))
        .filter(Offer.id == offer_id)
        .first()
    )
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.get("/", response_model=List[OfferOut])
def list_public_offers(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    offers = (
        db.query(Offer)
        .options(joinedload(Offer.items).joinedload(OfferItem.product))
        .order_by(Offer.created_at.desc())
        .all()
    )
    out: List[OfferOut] = []
    for offer in offers:
        data = _to_offer_out(offer, now=now, admin_view=False)
        if data:
            out.append(data)
    return out


@router.get("/admin", response_model=List[OfferOut])
def list_admin_offers(db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    now = datetime.utcnow()
    offers = (
        db.query(Offer)
        .options(joinedload(Offer.items).joinedload(OfferItem.product))
        .order_by(Offer.created_at.desc())
        .all()
    )
    return [_to_offer_out(offer, now=now, admin_view=True) for offer in offers]


@router.post("/", response_model=OfferOut)
def create_offer(payload: OfferCreate, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    _validate_offer_dates(payload.starts_at, payload.ends_at)
    offer = Offer(
        title=payload.title.strip(),
        badge=payload.badge.strip() if payload.badge else None,
        description=payload.description.strip() if payload.description else None,
        terms=payload.terms.strip() if payload.terms else None,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        is_active=payload.is_active,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    offer = _get_offer_or_404(db, offer.id)
    return _to_offer_out(offer, now=datetime.utcnow(), admin_view=True)


@router.put("/{offer_id}", response_model=OfferOut)
def update_offer(offer_id: int, payload: OfferUpdate, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    offer = _get_offer_or_404(db, offer_id)
    starts_at = payload.starts_at if payload.starts_at is not None else offer.starts_at
    ends_at = payload.ends_at if payload.ends_at is not None else offer.ends_at
    _validate_offer_dates(starts_at, ends_at)

    if payload.title is not None:
        offer.title = payload.title.strip()
    if payload.badge is not None:
        offer.badge = payload.badge.strip() or None
    if payload.description is not None:
        offer.description = payload.description.strip() or None
    if payload.terms is not None:
        offer.terms = payload.terms.strip() or None
    if payload.starts_at is not None:
        offer.starts_at = payload.starts_at
    if payload.ends_at is not None:
        offer.ends_at = payload.ends_at
    if payload.is_active is not None:
        offer.is_active = payload.is_active

    db.add(offer)
    db.commit()
    db.refresh(offer)
    offer = _get_offer_or_404(db, offer.id)
    return _to_offer_out(offer, now=datetime.utcnow(), admin_view=True)


@router.delete("/{offer_id}")
def delete_offer(offer_id: int, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    db.delete(offer)
    db.commit()
    return {"status": "deleted", "offer_id": offer_id}


@router.post("/{offer_id}/items", response_model=OfferOut)
def add_offer_item(offer_id: int, payload: OfferItemCreate, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    offer = _get_offer_or_404(db, offer_id)
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.query(OfferItem).filter(OfferItem.offer_id == offer_id, OfferItem.product_id == payload.product_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This product is already in the offer")

    item = OfferItem(
        offer_id=offer_id,
        product_id=payload.product_id,
        offer_price=float(payload.offer_price),
        old_price=float(payload.old_price) if payload.old_price is not None else float(product.price),
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()

    offer = _get_offer_or_404(db, offer_id)
    return _to_offer_out(offer, now=datetime.utcnow(), admin_view=True)


@router.put("/{offer_id}/items/{item_id}", response_model=OfferOut)
def update_offer_item(
    offer_id: int,
    item_id: int,
    payload: OfferItemUpdate,
    db: Session = Depends(get_db),
    current=Depends(require_role("staff")),
):
    offer = _get_offer_or_404(db, offer_id)
    item = db.query(OfferItem).filter(OfferItem.id == item_id, OfferItem.offer_id == offer_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Offer item not found")

    if payload.offer_price is not None:
        item.offer_price = float(payload.offer_price)
    if payload.old_price is not None:
        item.old_price = float(payload.old_price)
    if payload.is_active is not None:
        item.is_active = payload.is_active

    db.add(item)
    db.commit()

    offer = _get_offer_or_404(db, offer_id)
    return _to_offer_out(offer, now=datetime.utcnow(), admin_view=True)


@router.delete("/{offer_id}/items/{item_id}", response_model=OfferOut)
def delete_offer_item(offer_id: int, item_id: int, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    offer = _get_offer_or_404(db, offer_id)
    item = db.query(OfferItem).filter(OfferItem.id == item_id, OfferItem.offer_id == offer_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Offer item not found")
    db.delete(item)
    db.commit()

    offer = _get_offer_or_404(db, offer_id)
    return _to_offer_out(offer, now=datetime.utcnow(), admin_view=True)

