import asyncio
from datetime import datetime, timedelta
from ..database import SessionLocal
from ..models.models import ConversationSession

CLEAN_INTERVAL_SECONDS = int(60 * 30)  # 30 minutes
INACTIVITY_HOURS = 24

async def session_cleaner_loop():
    while True:
        try:
            clean_sessions()
        except Exception:
            pass
        await asyncio.sleep(CLEAN_INTERVAL_SECONDS)


def clean_sessions():
    db = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(hours=INACTIVITY_HOURS)
        q = db.query(ConversationSession).filter(ConversationSession.status == "active", ConversationSession.last_activity < threshold)
        for s in q.all():
            s.status = "closed"
            db.add(s)
        db.commit()
    finally:
        db.close()
