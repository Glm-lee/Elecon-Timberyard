from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

REDIS_URL             = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
POLL_INTERVAL         = int(os.getenv('NOTIFICATION_POLL_INTERVAL', '15'))
MAX_RETRIES           = int(os.getenv('NOTIFICATION_MAX_RETRIES', '5'))
SESSION_TIMEOUT_HOURS = int(os.getenv('SESSION_TIMEOUT_HOURS', '24'))

import redis.asyncio as aioredis
try:
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    REDIS_AVAILABLE = True
except Exception as exc:
    logger.warning('Redis not available, notifications disabled: %s', exc)
    redis_client = None
    REDIS_AVAILABLE = False

async def worker_loop():
    if not REDIS_AVAILABLE:
        logger.info('Redis not available, skipping worker_loop')
        return
    try:
        pubsub = redis_client.pubsub()
        await pubsub.psubscribe('admin:*')
        async for message in pubsub.listen():
            try:
                if message and message.get('type') == 'pmessage':
                    data = message.get('data')
                    if isinstance(data, bytes):
                        payload = json.loads(data.decode())
                    else:
                        payload = json.loads(data) if isinstance(data, str) else {}
                    logger.info('notification: %s', payload)
            except Exception as exc:
                logger.warning('worker_loop message error: %s', exc)
    except Exception as exc:
        logger.error('worker_loop fatal error: %s', exc)
        logger.info('Disabling Redis worker loop due to connection issues')
        return

async def retry_loop():
    logger.info('Notification retry loop starting (interval=%ds)', POLL_INTERVAL)
    while True:
        try:
            from ..database import SessionLocal
            db = SessionLocal()
            try:
                await _retry_pending(db)
            finally:
                db.close()
        except Exception as exc:
            logger.error('retry_loop tick error: %s', exc)
        await asyncio.sleep(POLL_INTERVAL)

async def _retry_pending(db):
    from ..services.notifications import get_pending_notifications, publish_event_sync
    pending = get_pending_notifications(db, limit=100)
    if not pending:
        return
    delivered = 0
    for notif in pending:
        try:
            payload = json.loads(notif.payload) if isinstance(notif.payload, str) else notif.payload
            ok = publish_event_sync(notif.event_type, payload)
            if ok:
                notif.status = 'delivered'
                notif.delivered_at = datetime.utcnow()
                delivered += 1
            else:
                notif.retry_count += 1
                notif.last_error = 'Redis unavailable'
                if notif.retry_count >= MAX_RETRIES:
                    notif.status = 'failed'
        except Exception as exc:
            notif.retry_count += 1
            notif.last_error = str(exc)[:400]
            if notif.retry_count >= MAX_RETRIES:
                notif.status = 'failed'
    db.commit()
    if delivered:
        logger.info('Retry loop: delivered %d/%d', delivered, len(pending))

async def session_cleaner_loop():
    logger.info('Session cleaner starting (timeout=%dh)', SESSION_TIMEOUT_HOURS)
    while True:
        try:
            from ..database import SessionLocal
            from ..models.models import ConversationSession
            db = SessionLocal()
            try:
                cutoff = datetime.utcnow() - timedelta(hours=SESSION_TIMEOUT_HOURS)
                stale = (
                    db.query(ConversationSession)
                    .filter(
                        ConversationSession.status == 'active',
                        ConversationSession.last_activity < cutoff,
                    )
                    .all()
                )
                for s in stale:
                    s.status = 'closed'
                    logger.info('Auto-closed stale session id=%d', s.id)
                if stale:
                    db.commit()
            finally:
                db.close()
        except Exception as exc:
            logger.error('session_cleaner_loop error: %s', exc)
        await asyncio.sleep(3600)
