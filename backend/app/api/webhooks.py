from fastapi import APIRouter, Request, BackgroundTasks, Depends, Response
from pydantic import BaseModel
from ..database import get_db
from sqlalchemy.orm import Session
from ..models.models import Customer, Conversation, Lead, ConversationSession, ConversationMessage
from datetime import datetime
import os

router = APIRouter()


def classify_interest(message: str) -> str:
    txt = message.lower()
    hot_keywords = ["price", "bei", "cost", "quantity", "qty", "deliver", "delivery", "order", "how many"]
    greet_keywords = ["hi", "hello", "morning", "afternoon", "evening", "hey"]
    if any(k in txt for k in hot_keywords):
        return "hot"
    if any(k in txt for k in greet_keywords) and len(txt.split()) <= 3:
        return "cold"
    return "warm"


@router.post("/twilio")
async def twilio_webhook(req: Request, bg: BackgroundTasks, db: Session = Depends(get_db)):
    # Read raw body for signature validation
    raw_body = await req.body()
    form = await req.form()
    from_number = form.get('From')
    body = form.get('Body')

    # Optional: validate Twilio signature if TWILIO_AUTH_TOKEN provided
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN", None)
    sig = req.headers.get("X-Twilio-Signature")
    validated = True
    if twilio_token and sig:
        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(twilio_token)
            url = str(req.url)
            # form is starlette.datastructures.FormData, convert to dict
            params = {k: v for k, v in form.items()}
            validated = validator.validate(url, params, sig)
        except Exception:
            validated = False

    if not validated:
        return Response(content="Invalid signature", status_code=400)

    # Find or create customer
    customer = None
    if from_number:
        customer = db.query(Customer).filter(Customer.phone == from_number).first()
    if not customer:
        customer = Customer(name="WhatsApp User", phone=from_number, preferred_channel="whatsapp")
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # Find existing active session for this customer
    session = db.query(ConversationSession).filter(ConversationSession.customer_id == customer.id, ConversationSession.status == "active").order_by(ConversationSession.last_activity.desc()).first()
    timestamp = datetime.utcnow().isoformat()
    if session:
        # append message row
        msg = ConversationMessage(session_id=session.id, sender="customer", message_text=body, message_type="text")
        db.add(msg)
        session.last_activity = datetime.utcnow()
    else:
        session = ConversationSession(customer_id=customer.id, channel="whatsapp", status="active", last_activity=datetime.utcnow())
        db.add(session)
        db.commit()
        db.refresh(session)
        msg = ConversationMessage(session_id=session.id, sender="customer", message_text=body, message_type="text")
        db.add(msg)
    db.commit()
    db.refresh(session)

    # Create lead
    interest = classify_interest(body or "")
    lead = Lead(customer_id=customer.id, source_channel="whatsapp", interest_level=interest, status="new")
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Orchestrate AI reply using structured business logic
    try:
        from ..ai.ai_engine import orchestrate_reply
        orc = orchestrate_reply(db, session, body)
        ai_reply = orc.get("ai_text") or "Thanks for contacting us. Our sales team will respond shortly."
    except Exception:
        ai_reply = "Thanks for contacting us. Our sales team will respond shortly."

    # Basic state extraction and transitions applied to session
    text = (body or "").lower()
    if any(k in text for k in ["cedar", "cypress", "pine", "mahogany"]):
        session.current_product = next((k for k in ["cedar", "cypress", "pine", "mahogany"] if k in text), None)
        session.conversation_state = "awaiting_size"
    if any(sz in text for sz in ["4x2", "3x2", "2x2", "4x1", "3x1"]):
        session.current_size = next((sz for sz in ["4x2", "3x2", "2x2", "4x1", "3x1"] if sz in text), None)
        if session.current_product:
            session.conversation_state = "awaiting_quantity"
        else:
            session.conversation_state = "awaiting_product"
    import re
    qty_match = re.search(r"(\d+)\s*(pieces|pcs|pieces|kg|bags)?", text)
    if qty_match:
        try:
            session.current_quantity = int(qty_match.group(1))
            session.conversation_state = "awaiting_location"
        except Exception:
            pass
    if any(loc in text for loc in ["nairobi", "rongai", "ruaka", "kitengela", "ruiru"]):
        session.current_location = next((loc for loc in ["nairobi", "rongai", "ruaka", "kitengela", "ruiru"] if loc in text), None)
        if session.current_quantity:
            session.conversation_state = "awaiting_quote_confirmation"

    # Append assistant message row
    assistant_msg = ConversationMessage(session_id=session.id, sender="assistant", message_text=ai_reply, message_type="text")
    db.add(assistant_msg)
    session.last_activity = datetime.utcnow()
    # persist session fields
    db.add(session)
    db.commit()
    db.refresh(session)

    # Increment analytics could be implemented here (placeholder)

    # Reply to Twilio using TwiML so Twilio sends message back to user
    twiml = f"<Response><Message>{ai_reply}</Message></Response>"
    return Response(content=twiml, media_type="application/xml")


@router.post("/meta")
async def meta_webhook(payload: dict):
    # stub for Facebook/Instagram webhook
    # payload will include messaging events
    return {"status": "received", "payload": payload}
