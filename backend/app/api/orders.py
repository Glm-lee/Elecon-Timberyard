from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Order, OrderItem, Product, Customer
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    items: List[OrderItemCreate]
    delivery_location: Optional[str] = None
    source_channel: Optional[str] = None

class OrderOut(BaseModel):
    id: int
    total_amount: float
    status: str
    source_channel: Optional[str] = None

    model_config = {
        "from_attributes": True,
    }

@router.post("/", response_model=OrderOut)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # find or create customer
    customer = db.query(Customer).filter(Customer.phone == order.customer_phone).first()
    if not customer:
        customer = Customer(name=order.customer_name, phone=order.customer_phone, email=order.customer_email)
        db.add(customer)
        db.commit()
        db.refresh(customer)

    total = 0.0
    db_order = Order(customer_id=customer.id, delivery_location=order.delivery_location, source_channel=order.source_channel)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    for it in order.items:
        product = db.query(Product).filter(Product.id == it.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        subtotal = product.price * it.quantity
        total += subtotal
        order_item = OrderItem(order_id=db_order.id, product_id=product.id, quantity=it.quantity, unit_price=product.price, subtotal=subtotal)
        db.add(order_item)
        # reduce stock
        product.stock_quantity = product.stock_quantity - it.quantity
    db_order.total_amount = total
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()

@router.put("/{order_id}/status")
def update_status(order_id: int, status: str, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db_order.status = status
    db.commit()
    db.refresh(db_order)
    return {"status": "updated"}
