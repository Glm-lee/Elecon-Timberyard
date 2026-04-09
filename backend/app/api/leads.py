import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Lead, Customer
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class LeadCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    source_channel: Optional[str] = None
    interest_level: str = "new"

class CustomerMiniOut(BaseModel):
    id: int
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    model_config = {
        "from_attributes": True,
    }

class LeadOut(BaseModel):
    id: int
    customer_id: int
    source_channel: Optional[str] = None
    interest_level: str
    status: str
    captured_at: Optional[datetime.datetime] = None
    customer: Optional[CustomerMiniOut] = None

    model_config = {
        "from_attributes": True,
    }

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    interest_level: Optional[str] = None

@router.post("/", response_model=LeadOut)
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.phone == lead.phone).first()
    if not customer:
        customer = Customer(name=lead.name, phone=lead.phone, email=lead.email)
        db.add(customer)
        db.commit()
        db.refresh(customer)
    db_lead = Lead(customer_id=customer.id, source_channel=lead.source_channel, interest_level=lead.interest_level)
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead

@router.get("/", response_model=List[LeadOut])
def list_leads(db: Session = Depends(get_db)):
    return db.query(Lead).all()


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if payload.status is not None:
        lead.status = payload.status
    if payload.interest_level is not None:
        lead.interest_level = payload.interest_level
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
