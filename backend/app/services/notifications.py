from __future__ import annotations
import json
import logging
import os
from datetime import datetime
from typing import AsyncGenerator, Dict, Optional

logger = logging.getLogger(__name__)

REDIS_URL     = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
ADMIN_CHANNEL = 'elecon:admin:inbox'

import redis.asyncio as aioredis
try:
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    REDIS_AVAILABLE = True
except Exception as exc:
    logger.warning('Redis not available, notifications disabled: %s', exc)
    redis_client = None
    REDIS_AVAILABLE = False

def _sync_redis():
    try:
        import redis as sync_redis
        return sync_redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as exc:
        logger.warning('Sync Redis unavailable: %s', exc)
        return None

async def publish_admin_notification(admin_id: int, payload: Dict):
    if not REDIS_AVAILABLE:
        logger.debug('Redis not available, skipping notification: %s', payload)
        return
    channel = f'admin:{admin_id}'
    try:
        await redis_client.publish(channel, json.dumps(payload))
    except Exception as exc:
        logger.warning('publish_admin_notification failed: %s', exc)

def publish_new_message_sync(session_id: int, message_payload: dict) -> bool:
    payload = {'event': 'new_message', 'session_id': session_id, **message_payload}
    r = _sync_redis()
    if r:
        try:
            r.publish(ADMIN_CHANNEL, json.dumps(payload))
            return True
        except Exception as exc:
            logger.warning('publish_new_message_sync failed: %s', exc)
    return False

def publish_event_sync(event_type: str, payload: dict) -> bool:
    data = {'event': event_type, **payload}
    r = _sync_redis()
    if r:
        try:
            r.publish(ADMIN_CHANNEL, json.dumps(data))
            return True
        except Exception as exc:
            logger.warning('publish_event_sync failed: %s', exc)
    return False

async def subscribe_admin_messages_async() -> AsyncGenerator[dict, None]:
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(ADMIN_CHANNEL)
        await pubsub.psubscribe('admin:*')
        try:
            async for raw in pubsub.listen():
                if raw['type'] in ('message', 'pmessage'):
                    try:
                        yield json.loads(raw['data'])
                    except Exception:
                        pass
        finally:
            await pubsub.unsubscribe()
            await r.aclose()
    except Exception as exc:
        logger.warning('subscribe_admin_messages_async unavailable: %s', exc)
        return

def persist_notification(db, event_type: str, payload: dict, session_id: Optional[int] = None):
    try:
        from ..models.notification_model import Notification
        notif = Notification(
            session_id=session_id,
            event_type=event_type,
            payload=json.dumps(payload),
            status='pending',
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
    except Exception as exc:
        logger.warning('persist_notification failed: %s', exc)
        return None

def get_pending_notifications(db, limit: int = 100) -> list:
    try:
        from ..models.notification_model import Notification
        return (
            db.query(Notification)
            .filter(Notification.status == 'pending', Notification.retry_count < 5)
            .order_by(Notification.created_at.asc())
            .limit(limit)
            .all()
        )
    except Exception as exc:
        logger.warning('get_pending_notifications failed: %s', exc)
        return []

def ack_notification(db, notification_id: int, admin_id: Optional[int] = None):
    try:
        from ..models.notification_model import Notification
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if notif:
            notif.status = 'delivered'
            notif.delivered_at = datetime.utcnow()
            notif.delivered_to_admin_id = admin_id
            db.commit()
    except Exception as exc:
        logger.warning('ack_notification failed: %s', exc)

async def close_redis():
    try:
        await redis_client.aclose()
    except Exception:
        pass
