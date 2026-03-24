from __future__ import annotations
import base64, json, logging, os
from datetime import datetime
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Session
from ..database import get_db, Base
from ..models.models import Order

logger = logging.getLogger(__name__)
router = APIRouter()

CONSUMER_KEY    = os.getenv('MPESA_CONSUMER_KEY', '')
CONSUMER_SECRET = os.getenv('MPESA_CONSUMER_SECRET', '')
SHORTCODE       = os.getenv('MPESA_SHORTCODE', '174379')
PASSKEY         = os.getenv('MPESA_PASSKEY', '')
CALLBACK_URL    = os.getenv('MPESA_CALLBACK_URL', 'https://example.com/payments/mpesa/callback')
ENV             = os.getenv('MPESA_ENV', 'sandbox')
BASE_URL        = 'https://sandbox.safaricom.co.ke' if ENV != 'production' else 'https://api.safaricom.co.ke'

class Payment(Base):
    __tablename__ = 'payments'
    id                  = Column(Integer, primary_key=True, index=True)
    order_id            = Column(Integer, ForeignKey('orders.id'), nullable=True, index=True)
    merchant_request_id = Column(String(100), nullable=True)
    checkout_request_id = Column(String(100), nullable=True, unique=True, index=True)
    mpesa_receipt       = Column(String(100), nullable=True)
    phone               = Column(String(20), nullable=True)
    amount              = Column(Float, nullable=False, default=0)
    status              = Column(String(30), nullable=False, default='pending', index=True)
    result_code         = Column(String(10), nullable=True)
    result_desc         = Column(String(200), nullable=True)
    initiated_at        = Column(DateTime, default=datetime.utcnow)
    completed_at        = Column(DateTime, nullable=True)
    raw_callback        = Column(String(4000), nullable=True)

class STKPushRequest(BaseModel):
    order_id: int
    phone: str
    amount: float
    description: str = 'Timber order payment'
    account_ref: Optional[str] = None

class STKPushResponse(BaseModel):
    merchant_request_id: str
    checkout_request_id: str
    response_code: str
    response_description: str
    customer_message: str

class PaymentStatusResponse(BaseModel):
    order_id: int
    payment_status: str
    mpesa_receipt: Optional[str] = None
    amount_paid: Optional[float] = None
    phone: Optional[str] = None
    paid_at: Optional[datetime] = None

def _format_phone(phone: str) -> str:
    phone = phone.strip().replace(' ', '').replace('+', '').replace('-', '')
    if phone.startswith('0'): phone = '254' + phone[1:]
    if not phone.startswith('254'): phone = '254' + phone
    return phone

async def _get_access_token() -> str:
    creds = base64.b64encode(f'{CONSUMER_KEY}:{CONSUMER_SECRET}'.encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.get(f'{BASE_URL}/oauth/v1/generate?grant_type=client_credentials', headers={'Authorization': f'Basic {creds}'}, timeout=15)
        resp.raise_for_status()
        return resp.json()['access_token']

def _generate_password(timestamp: str) -> str:
    return base64.b64encode(f'{SHORTCODE}{PASSKEY}{timestamp}'.encode()).decode()

@router.post('/stk-push', response_model=STKPushResponse)
async def initiate_stk_push(req: STKPushRequest, db: Session = Depends(get_db)):
    if not CONSUMER_KEY or not PASSKEY:
        raise HTTPException(status_code=503, detail='M-Pesa not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY.')
    phone     = _format_phone(req.phone)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    password  = _generate_password(timestamp)
    account_ref = req.account_ref or f'ORDER{req.order_id}'
    amount    = int(req.amount)
    try:
        token = await _get_access_token()
    except Exception as exc:
        logger.error('M-Pesa token fetch failed: %s', exc)
        raise HTTPException(status_code=502, detail='Could not connect to M-Pesa.')
    payload = {'BusinessShortCode': SHORTCODE, 'Password': password, 'Timestamp': timestamp, 'TransactionType': 'CustomerPayBillOnline', 'Amount': amount, 'PartyA': phone, 'PartyB': SHORTCODE, 'PhoneNumber': phone, 'CallBackURL': CALLBACK_URL, 'AccountReference': account_ref, 'TransactionDesc': req.description[:200]}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f'{BASE_URL}/mpesa/stkpush/v1/processrequest', json=payload, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f'M-Pesa STK push failed: {exc}')
    payment = Payment(order_id=req.order_id, merchant_request_id=data.get('MerchantRequestID'), checkout_request_id=data.get('CheckoutRequestID'), phone=phone, amount=req.amount, status='pending')
    db.add(payment)
    db.commit()
    logger.info('STK Push initiated order=%d phone=%s', req.order_id, phone)
    return STKPushResponse(merchant_request_id=data.get('MerchantRequestID',''), checkout_request_id=data.get('CheckoutRequestID',''), response_code=data.get('ResponseCode',''), response_description=data.get('ResponseDescription',''), customer_message=data.get('CustomerMessage',''))

@router.post('/callback')
async def mpesa_callback(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    logger.info('M-Pesa callback: %s', body)
    try:
        stk = body['Body']['stkCallback']
        checkout_request_id = stk['CheckoutRequestID']
        result_code = str(stk['ResultCode'])
        payment = db.query(Payment).filter(Payment.checkout_request_id == checkout_request_id).first()
        if not payment:
            return {'ResultCode': 0, 'ResultDesc': 'Accepted'}
        payment.result_code = result_code
        payment.result_desc = stk.get('ResultDesc', '')
        payment.raw_callback = json.dumps(body)[:4000]
        if result_code == '0':
            items = {item['Name']: item.get('Value') for item in stk.get('CallbackMetadata', {}).get('Item', [])}
            payment.mpesa_receipt = str(items.get('MpesaReceiptNumber', ''))
            payment.amount        = float(items.get('Amount', payment.amount))
            payment.phone         = str(items.get('PhoneNumber', payment.phone))
            payment.status        = 'completed'
            payment.completed_at  = datetime.utcnow()
            if payment.order_id:
                order = db.query(Order).filter(Order.id == payment.order_id).first()
                if order:
                    order.payment_status = 'paid'
                    order.status = 'confirmed'
        elif result_code == '1032':
            payment.status = 'cancelled'
        else:
            payment.status = 'failed'
        db.commit()
        try:
            from ..services.notifications import publish_event_sync
            publish_event_sync('payment_update', {'order_id': payment.order_id, 'status': payment.status, 'mpesa_receipt': payment.mpesa_receipt, 'amount': payment.amount})
        except Exception:
            pass
    except Exception as exc:
        logger.error('M-Pesa callback error: %s', exc)
    return {'ResultCode': 0, 'ResultDesc': 'Accepted'}

@router.get('/status/{order_id}', response_model=PaymentStatusResponse)
def get_payment_status(order_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.order_id == order_id).order_by(Payment.initiated_at.desc()).first()
    if not payment:
        raise HTTPException(status_code=404, detail='No payment found for this order')
    return PaymentStatusResponse(order_id=order_id, payment_status=payment.status, mpesa_receipt=payment.mpesa_receipt, amount_paid=payment.amount if payment.status == 'completed' else None, phone=payment.phone, paid_at=payment.completed_at)
