from fastapi import APIRouter, Depends
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

class LeadOut(BaseModel):
    id: int
    customer_id: int
    source_channel: Optional[str] = None
    interest_level: str
    status: str

    model_config = {
        "from_attributes": True,
    }

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
