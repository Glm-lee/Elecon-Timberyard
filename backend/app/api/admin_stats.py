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
    revenue_this_week: float
    revenue_this_month: float
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


class RevenueBreakdownPoint(BaseModel):
    label: str
    revenue: float
    orders: int

class ChannelStat(BaseModel):
    channel: str
    count: int
    percentage: float

@router.get('/stats', response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
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
    revenue_week = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.status != 'cancelled', Order.created_at >= week_start).scalar() or 0.0
    revenue_month = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(Order.status != 'cancelled', Order.created_at >= month_start).scalar() or 0.0
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
        revenue_this_week=float(revenue_week), revenue_this_month=float(revenue_month),
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


@router.get('/revenue-breakdown', response_model=list[RevenueBreakdownPoint])
def get_revenue_breakdown(period: str = Query('day', pattern='^(day|week|month)$'), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    if period == 'day':
        since = now - timedelta(days=14)
    elif period == 'week':
        since = now - timedelta(days=7 * 12)
    else:
        since = now - timedelta(days=31 * 12)

    rows = db.query(Order).filter(Order.status != 'cancelled', Order.created_at >= since).all()

    buckets: dict[str, dict[str, float | int]] = {}
    for order in rows:
        dt = order.created_at or now
        if period == 'day':
            key = dt.strftime('%Y-%m-%d')
        elif period == 'week':
            year, week_num, _ = dt.isocalendar()
            key = f'{year}-W{int(week_num):02d}'
        else:
            key = dt.strftime('%Y-%m')

        if key not in buckets:
            buckets[key] = {'revenue': 0.0, 'orders': 0}
        buckets[key]['revenue'] = float(buckets[key]['revenue']) + float(order.total_amount or 0)
        buckets[key]['orders'] = int(buckets[key]['orders']) + 1

    return [
        RevenueBreakdownPoint(label=label, revenue=float(data['revenue']), orders=int(data['orders']))
        for label, data in sorted(buckets.items(), key=lambda x: x[0])
    ]

@router.get('/channel-stats', response_model=list[ChannelStat])
def get_channel_stats(db: Session = Depends(get_db)):
    rows = db.query(Lead.source_channel, func.count(Lead.id).label('count')).group_by(Lead.source_channel).order_by(func.count(Lead.id).desc()).all()
    total = sum(r.count for r in rows) or 1
    return [ChannelStat(channel=r.source_channel or 'unknown', count=r.count, percentage=round(r.count / total * 100, 1)) for r in rows]
