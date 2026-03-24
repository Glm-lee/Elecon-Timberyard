from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Product
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ProductCreate(BaseModel):
    name: str
    wood_type: str
    size: str
    price: float
    stock_quantity: int = 0
    image_url: Optional[str] = None
    description: Optional[str] = None

class ProductOut(BaseModel):
    id: int
    name: str
    wood_type: str
    size: str
    price: float
    stock_quantity: int
    availability: str
    image_url: Optional[str] = None
    description: Optional[str] = None

    model_config = {
        "from_attributes": True,
    }

@router.get("/", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.post("/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in product.dict().items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(db_product)
    db.commit()
    return {"status": "deleted"}
