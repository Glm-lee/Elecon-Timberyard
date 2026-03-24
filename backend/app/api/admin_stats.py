from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Lead, Order, ConversationSession, Product, Customer

router = APIRouter()
LOW_STOCK_THRESHOLD = 50

class DashboardStats(BaseModel):
    active_sessions: int
    pending_human_sessions: int
    total_sessions_today: int
    total_leads: int
    hot_leads: int
    warm_leads: int
    cold_leads: int
    converted_leads: int
    new_leads_today: int
    pending_orders: int
    confirmed_orders: int
    total_orders: int
    total_revenue: float
    revenue_today: float
    total_customers: int
    new_customers_today: int
    low_stock_products: int
    out_of_stock_products: int

class StockAlert(BaseModel):
    id: int
    name: str
    wood_type: Optional[str] = None
    size: Optional[str] = None
    stock_quantity: int
    price: Optional[float] = None

    model_config = {
        "from_attributes": True,
    }

class RevenuePoint(BaseModel):
    date: str
    revenue: float
    orders: int

class ChannelStat(BaseModel):
    channel: str
    count: int
    percentage: float

@router.get('/stats', response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    active_sessions = db.query(func.count(ConversationSession.id)).filter(ConversationSession.status == 'active').scalar() or 0
    try:
        pending_human = db.query(func.count(ConversationSession.id)).filter(ConversationSession.status == 'pending_human').scalar() or 0
    except Exception:
        pending_human = 0
    sessions_today = db.query(func.count(ConversationSession.id)).filter(ConversationSession.last_activity >= today).scalar() or 0
    lead_counts = dict(db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all())
    total_leads = sum(lead_counts.values())
    new_leads_today = db.query(func.count(Lead.id)).filter(Lead.captured_at >= today).scalar() or 0
    order_counts = dict(db.query(Order.status, func.count(Order.id)).group_by(Order.status).all())
    total_revenue = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.status != 'cancelled').scalar() or 0.0
    revenue_today = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.status != 'cancelled', Order.created_at >= today).scalar() or 0.0
    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    new_customers_today = db.query(func.count(Customer.id)).filter(Customer.created_at >= today).scalar() or 0
    low_stock = db.query(func.count(Product.id)).filter(and_(Product.stock_quantity > 0, Product.stock_quantity < LOW_STOCK_THRESHOLD)).scalar() or 0
    out_of_stock = db.query(func.count(Product.id)).filter(Product.stock_quantity == 0).scalar() or 0
    return DashboardStats(
        active_sessions=active_sessions, pending_human_sessions=pending_human,
        total_sessions_today=sessions_today, total_leads=total_leads,
        hot_leads=lead_counts.get('hot', 0), warm_leads=lead_counts.get('warm', 0),
        cold_leads=lead_counts.get('cold', 0), converted_leads=lead_counts.get('converted', 0),
        new_leads_today=new_leads_today, pending_orders=order_counts.get('pending', 0),
        confirmed_orders=order_counts.get('confirmed', 0), total_orders=sum(order_counts.values()),
        total_revenue=float(total_revenue), revenue_today=float(revenue_today),
        total_customers=total_customers, new_customers_today=new_customers_today,
        low_stock_products=low_stock, out_of_stock_products=out_of_stock,
    )

@router.get('/stock-alerts', response_model=list[StockAlert])
def get_stock_alerts(threshold: int = Query(50, ge=1), db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.stock_quantity < threshold).order_by(Product.stock_quantity.asc()).all()

@router.get('/revenue-chart', response_model=list[RevenuePoint])
def get_revenue_chart(days: int = Query(30, ge=7, le=90), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    rows = db.query(func.date(Order.created_at).label('date'), func.coalesce(func.sum(Order.total_amount), 0).label('revenue'), func.count(Order.id).label('orders')).filter(Order.created_at >= since, Order.status != 'cancelled').group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at).asc()).all()
    return [RevenuePoint(date=str(r.date), revenue=float(r.revenue), orders=r.orders) for r in rows]

@router.get('/channel-stats', response_model=list[ChannelStat])
def get_channel_stats(db: Session = Depends(get_db)):
    rows = db.query(Lead.source_channel, func.count(Lead.id).label('count')).group_by(Lead.source_channel).order_by(func.count(Lead.id).desc()).all()
    total = sum(r.count for r in rows) or 1
    return [ChannelStat(channel=r.source_channel or 'unknown', count=r.count, percentage=round(r.count / total * 100, 1)) for r in rows]
