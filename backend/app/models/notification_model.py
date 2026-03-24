from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from ..database import Base

class Notification(Base):
    __tablename__ = 'notifications'

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(Integer, nullable=True, index=True)
    event_type  = Column(String(50), nullable=False, index=True)
    payload     = Column(Text, nullable=False, default='{}')
    status      = Column(String(20), nullable=False, default='pending', index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    last_error  = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    delivered_to_admin_id = Column(Integer, nullable=True)
