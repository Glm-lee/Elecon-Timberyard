from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
import datetime
import os
from pydantic import BaseModel
from ..database import get_db
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.models import ConversationSession, Customer, ConversationMessage
from ..models.models import Order, OrderItem, Product
from ..api.auth import require_role
from typing import List

router = APIRouter()


class SessionStatusUpdate(BaseModel):
    status: str


class AdminMessagePayload(BaseModel):
    content: str
    message_type: str = "text"


@router.get("/sessions")
def list_sessions(status: str = "active", page: int = 1, page_size: int = 20, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 100")

    base_q = db.query(ConversationSession)
    if status != "all":
        base_q = base_q.filter(ConversationSession.status == status)
    total = base_q.count()
    q = base_q.order_by(ConversationSession.last_activity.desc()).offset((page - 1) * page_size).limit(page_size)
    out = []
    for s in q.all():
        customer = db.query(Customer).filter(Customer.id == s.customer_id).first()
        last_msg = db.query(ConversationMessage).filter(ConversationMessage.session_id == s.id).order_by(ConversationMessage.timestamp.desc()).first()
        # unread count = customer messages not read
        unread_count = db.query(ConversationMessage).filter(ConversationMessage.session_id == s.id, ConversationMessage.sender == "customer", ConversationMessage.read == False).count()
        lead_score = "cold"
        if s.conversation_state in ["awaiting_quote_confirmation", "awaiting_payment"]:
            lead_score = "hot"
        elif s.conversation_state in ["awaiting_quantity"]:
            lead_score = "warm"
        out.append({
            "session_id": s.id,
            "status": s.status,
            "customer_name": customer.name if customer else None,
            "phone": customer.phone if customer else None,
            "current_state": s.conversation_state,
            "lead_score": lead_score,
            "last_message": last_msg.message_text if last_msg else None,
            "last_activity": s.last_activity.isoformat(),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "unread_count": unread_count,
            "channel": s.channel,
        })
    return {"total": total, "page": page, "page_size": page_size, "sessions": out}


@router.post("/sessions/{session_id}/status")
def update_session_status(session_id: int, payload: SessionStatusUpdate, db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    allowed = {"active", "pending_human", "closed"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(allowed)}")
    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    session.status = payload.status
    session.last_activity = datetime.datetime.utcnow()
    db.add(session)
    db.commit()
    return {"status": "ok", "session_id": session_id, "new_status": payload.status}


@router.get("/sessions/{session_id}/messages")
def list_session_messages(session_id: int = Path(..., gt=0), page: int = 1, page_size: int = 50, sort: str = Query("asc", pattern="^(asc|desc)$"), db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 200:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 200")

    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    base_q = db.query(ConversationMessage).filter(ConversationMessage.session_id == session_id)
    total = base_q.count()
    order = ConversationMessage.timestamp.asc() if sort == "asc" else ConversationMessage.timestamp.desc()
    q = base_q.order_by(order).offset((page - 1) * page_size).limit(page_size)
    msgs = []
    for m in q.all():
        msgs.append({
            "id": m.id,
            "sender": m.sender,
            "message_text": m.message_text,
            "timestamp": m.timestamp.isoformat(),
            "read": bool(m.read),
            "message_type": m.message_type,
        })
    return {"total": total, "page": page, "page_size": page_size, "messages": msgs}


@router.post("/sessions/{session_id}/messages/{message_id}/mark_read")
def mark_message_read(session_id: int = Path(..., gt=0), message_id: int = Path(..., gt=0), db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    msg = db.query(ConversationMessage).filter(ConversationMessage.id == message_id, ConversationMessage.session_id == session_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="message not found")
    msg.read = True
    db.add(msg)
    db.commit()
    return {"status": "ok", "message_id": msg.id}


@router.post("/sessions/{session_id}/mark-read")
def mark_session_read(session_id: int = Path(..., gt=0), db: Session = Depends(get_db), current=Depends(require_role("staff"))):
    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    updated = (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.session_id == session_id,
            ConversationMessage.sender == "customer",
            ConversationMessage.read == False,
        )
        .update({"read": True}, synchronize_session=False)
    )
    db.commit()
    return {"status": "ok", "session_id": session_id, "updated": updated}


@router.post("/sessions/{session_id}/messages/send")
def send_admin_message(
    session_id: int,
    payload: AdminMessagePayload | None = Body(default=None),
    content: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current=Depends(require_role("staff")),
):
    resolved_content = (payload.content if payload and payload.content else content or "").strip()
    if not resolved_content:
        raise HTTPException(status_code=400, detail="content is required")
    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    # create admin message row
    # detect structured type prefix e.g., "quote:"
    message_type = "text"
    if resolved_content.lower().startswith("quote:"):
        message_type = "quote"
        content_body = resolved_content[len("quote:"):].strip()
    else:
        content_body = resolved_content
    msg = ConversationMessage(session_id=session.id, sender="admin", message_text=content_body, message_type=message_type, read=True)
    db.add(msg)
    session.last_activity = datetime.datetime.utcnow()
    if session.status == "pending_human":
        session.status = "active"
    db.add(session)
    db.commit()
    db.refresh(msg)

    # send via Twilio if whatsapp
    if session.channel == "whatsapp":
        try:
            from twilio.rest import Client
            tw_sid = os.getenv("TWILIO_ACCOUNT_SID")
            tw_token = os.getenv("TWILIO_AUTH_TOKEN")
            tw_from = os.getenv("TWILIO_WHATSAPP_NUMBER")
            client = Client(tw_sid, tw_token)
            # customer phone
            customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
            if customer and customer.phone:
                to_number = customer.phone
                body = content_body
                client.messages.create(body=body, from_=f"whatsapp:{tw_from}", to=to_number)
        except Exception:
            pass

    # If admin sent a quote confirmation, create order
    try:
        if message_type == "quote":
            # admin provided a quote; if admin writes 'confirm' in content_body, create order
            if content_body.lower().startswith("confirm") or content_body.lower().startswith("confirm:"):
                # create simple order from session fields
                customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
                if customer and session.current_product and session.current_quantity:
                    # find product
                    prod = db.query(Product).filter(
                        or_(
                            Product.wood_type.ilike(f"%{session.current_product}%"),
                            Product.name.ilike(f"%{session.current_product}%"),
                        ),
                        Product.size.ilike(f"%{session.current_size}%"),
                    ).first()
                    if not prod:
                        prod = db.query(Product).filter(
                            or_(
                                Product.wood_type.ilike(f"%{session.current_product}%"),
                                Product.name.ilike(f"%{session.current_product}%"),
                            )
                        ).first()
                    total_amount = session.quote_amount or 0
                    order = Order(customer_id=customer.id, total_amount=total_amount, status="confirmed", source_channel=session.channel, delivery_location=session.current_location, payment_status="pending")
                    db.add(order)
                    db.commit()
                    db.refresh(order)
                    if prod:
                        item = OrderItem(order_id=order.id, product_id=prod.id, quantity=session.current_quantity or 0, unit_price=prod.price, subtotal=(prod.price * (session.current_quantity or 0)))
                        db.add(item)
                    # close session
                    session.status = "closed"
                    db.add(session)
                    db.commit()
    except Exception:
        db.rollback()

    # notify admins via websocket (optional)
    try:
        from ..services.notifications import publish_admin_notification
        import asyncio
        loop = asyncio.get_running_loop()
        loop.create_task(
            publish_admin_notification(
                1,
                {"type": "new_admin_message", "session_id": session.id, "message": content_body},
            )
        )
    except Exception:
        pass

    return {"status": "sent", "message_id": msg.id}
