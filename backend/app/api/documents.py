from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.pdf_generator import generate_quote_pdf, generate_invoice_pdf, invoice_data_from_order

logger = logging.getLogger(__name__)
router = APIRouter()

class QuoteLineItem(BaseModel):
    description: str
    qty: float = 1
    unit: str = 'm'
    unit_price: float
    subtotal: float

class QuotePreviewRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    delivery_address: Optional[str] = None
    items: list[QuoteLineItem]
    notes: Optional[str] = None
    quote_number: Optional[str] = None

@router.get('/quote/{session_id}')
def download_session_quote(session_id: int, db: Session = Depends(get_db)):
    from ..models.models import ConversationSession, ConversationMessage, Customer
    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    customer = db.query(Customer).filter(Customer.id == session.customer_id).first() if session.customer_id else None
    quote_msg = db.query(ConversationMessage).filter(ConversationMessage.session_id == session_id, ConversationMessage.message_type == 'quote').order_by(ConversationMessage.timestamp.desc()).first()
    ref = f'QT-{session_id}-{datetime.utcnow().strftime("%H%M%S")}'
    quote_data = {
        'quote_number': ref,
        'issue_date': datetime.utcnow().strftime('%d %B %Y'),
        'customer': {
            'name':    customer.name     if customer else 'Customer',
            'phone':   customer.phone    if customer else '',
            'email':   customer.email    if customer else '',
            'address': customer.location if customer else '',
        },
        'items': [],
        'notes': quote_msg.message_text if quote_msg else 'Please contact us to finalise this quote.',
    }
    try:
        pdf_bytes = generate_quote_pdf(quote_data)
    except Exception as exc:
        logger.error('Quote PDF failed session=%d: %s', session_id, exc)
        raise HTTPException(status_code=500, detail='PDF generation failed')
    filename = f'Elecon_Quote_{ref}.pdf'
    return Response(content=pdf_bytes, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{filename}"'})

@router.get('/invoice/{order_id}')
def download_invoice(order_id: int, db: Session = Depends(get_db)):
    from ..models.models import Order, Customer, OrderItem, Product
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    order.customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    for item in items:
        item.product = db.query(Product).filter(Product.id == item.product_id).first()
    order.items = items
    payment = None
    try:
        from ..integrations.mpesa import Payment
        payment = db.query(Payment).filter(Payment.order_id == order_id, Payment.status == 'completed').order_by(Payment.completed_at.desc()).first()
    except Exception:
        pass
    invoice_data = invoice_data_from_order(order, payment)
    try:
        pdf_bytes = generate_invoice_pdf(invoice_data)
    except Exception as exc:
        logger.error('Invoice PDF failed order=%d: %s', order_id, exc)
        raise HTTPException(status_code=500, detail='PDF generation failed')
    filename = f'Elecon_Invoice_{invoice_data["invoice_number"]}.pdf'
    return Response(content=pdf_bytes, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{filename}"'})

@router.post('/quote/preview')
def preview_quote(req: QuotePreviewRequest):
    ref = req.quote_number or f'QT-ADHOC-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}'
    quote_data = {
        'quote_number': ref,
        'issue_date': datetime.utcnow().strftime('%d %B %Y'),
        'customer': {'name': req.customer_name or 'Customer', 'phone': req.customer_phone or '', 'email': req.customer_email or ''},
        'delivery_addr': {'address': req.delivery_address} if req.delivery_address else None,
        'items': [item.model_dump() for item in req.items],
        'notes': req.notes or '',
    }
    try:
        pdf_bytes = generate_quote_pdf(quote_data)
    except Exception as exc:
        logger.error('Ad-hoc quote PDF failed: %s', exc)
        raise HTTPException(status_code=500, detail='PDF generation failed')
    filename = f'Elecon_Quote_{ref}.pdf'
    return Response(content=pdf_bytes, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{filename}"'})
