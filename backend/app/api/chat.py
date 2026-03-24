from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import ConversationSession, ConversationMessage, Customer
from pydantic import BaseModel
from typing import List, Optional
import datetime

router = APIRouter()

class StartSessionRequest(BaseModel):
    customer_phone: Optional[str] = None
    phone: Optional[str] = None
    customer_name: Optional[str] = None
    channel: str = "web"
    source: Optional[str] = None

    model_config = {
        "extra": "allow",
    }

class SendMessageRequest(BaseModel):
    message: str
    sender: str = "customer"

class MessageOut(BaseModel):
    id: int
    session_id: int
    sender: str
    message_text: str
    timestamp: datetime.datetime
    message_type: str
    read: bool

    model_config = {
        "from_attributes": True,
    }

class ChatMessage(BaseModel):
    source: str
    message: str
    customer_phone: Optional[str] = None

class ChatOut(BaseModel):
    id: int
    session_id: Optional[int] = None
    sender: Optional[str] = None
    message_text: Optional[str] = None
    conversation_history: Optional[str] = None

    model_config = {
        "from_attributes": True,
    }

class SessionOut(BaseModel):
    id: int
    customer_id: Optional[int] = None
    channel: str
    status: str
    conversation_state: str
    last_activity: datetime.datetime

    model_config = {
        "from_attributes": True,
    }

@router.post("/message", response_model=ChatOut)
def post_message(msg: ChatMessage, db: Session = Depends(get_db)):
    # backward compatibility for the old contract
    customer = None
    if msg.customer_phone:
        customer = db.query(Customer).filter(Customer.phone == msg.customer_phone).first()

    session = ConversationSession(
        customer_id=customer.id if customer else None,
        channel=msg.source,
        status="active",
        conversation_state="greeting"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    message = ConversationMessage(
        session_id=session.id,
        sender="customer",
        message_text=msg.message,
        message_type="text"
    )
    db.add(message)
    db.commit()

    from ..ai.ai_engine import orchestrate_reply
    ai_result = orchestrate_reply(db, session, msg.message)
    ai_response_text = ai_result.get("ai_text", "Thanks for your message.")

    ai_response = ConversationMessage(
        session_id=session.id,
        sender="assistant",
        message_text=ai_response_text,
        message_type="text"
    )
    db.add(ai_response)
    db.commit()
    db.refresh(ai_response)

    return ChatOut(id=ai_response.id, session_id=session.id, sender=ai_response.sender, message_text=ai_response.message_text)

@router.post("/session", response_model=SessionOut)
def start_session(req: StartSessionRequest, db: Session = Depends(get_db)):
    try:
        customer = None
        phone_to_use = req.customer_phone or req.phone
        
        if phone_to_use:
            customer = db.query(Customer).filter(Customer.phone == phone_to_use).first()
            if not customer:
                customer = Customer(
                    phone=phone_to_use, 
                    name=req.customer_name or "", 
                    email="", 
                    preferred_channel=req.channel or "web", 
                    location=""
                )
                db.add(customer)
                db.commit()
                db.refresh(customer)
        
        session = ConversationSession(
            customer_id=customer.id if customer else None,
            channel=req.channel or req.source or "web",
            status="active",
            conversation_state="greeting"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    except Exception as e:
        db.rollback()
        import traceback
        print(f"ERROR in start_session: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating session: {str(e)}")

@router.post("/sessions/{session_id}/messages", response_model=MessageOut)
def send_message(session_id: int, req: SendMessageRequest, db: Session = Depends(get_db)):
    session = db.query(ConversationSession).filter(ConversationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    message = ConversationMessage(
        session_id=session_id,
        sender=req.sender,
        message_text=req.message,
        message_type="text"
    )
    db.add(message)
    
    # Update session last activity
    session.last_activity = datetime.datetime.utcnow()
    
    # Generate AI response using orchestration
    from ..ai.ai_engine import orchestrate_reply
    ai_result = orchestrate_reply(db, session, req.message)
    ai_response_text = ai_result["ai_text"]
    
    ai_response = ConversationMessage(
        session_id=session_id,
        sender="assistant",
        message_text=ai_response_text,
        message_type="text"
    )
    db.add(ai_response)
    db.commit()
    db.refresh(ai_response)
    
    return ai_response

@router.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_messages(session_id: int, db: Session = Depends(get_db)):
    messages = db.query(ConversationMessage).filter(ConversationMessage.session_id == session_id).order_by(ConversationMessage.timestamp).all()
    return messages


# Simple in-memory connection manager for WebSocket chat
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # here you would call AI orchestration to generate a reply
            from ..ai.ai_engine import ask_ai
            reply = ask_ai(f"Customer ({client_id}) said: {data}")
            await manager.send_personal_message(reply, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Admin notification websocket
@router.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket, token: str = None):
    # Expect token as query param: /ws/admin?token=...
    from ..api.auth import get_current_user
    from ..services.notifications import redis_client
    from jose import JWTError, jwt
    await websocket.accept()
    try:
        # simple token extraction
        query = websocket.scope.get("query_string", b"").decode()
        params = dict(x.split("=") for x in query.split("&") if "=" in x)
        token = params.get("token")
        if not token:
            await websocket.close(code=4001)
            return
        # decode token (reuse SECRET_KEY from auth)
        from ..api.auth import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin_email = payload.get("sub")
        # resolve admin id from DB
        from ..database import SessionLocal
        db = SessionLocal()
        from ..models.models import AdminUser
        admin = db.query(AdminUser).filter(AdminUser.email == admin_email).first()
        db.close()
        if not admin:
            await websocket.close(code=4003)
            return
        # enforce role
        if admin.role not in ("staff", "owner", "manager"):
            await websocket.close(code=4003)
            return
        # check token expiry
        exp = payload.get('exp')
        import time
        if exp and time.time() > exp:
            await websocket.close(code=4004)
            return

        # subscribe to redis channel for this admin
        pubsub = redis_client.pubsub()
        channel = f"admin:{admin.id}"
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if isinstance(data, bytes):
                        await websocket.send_text(data.decode())
                    else:
                        await websocket.send_text(str(data))
        finally:
            await pubsub.unsubscribe(channel)
    except WebSocketDisconnect:
        try:
            await websocket.close()
        except Exception:
            pass
