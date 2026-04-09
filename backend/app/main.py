from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from .api import products, orders, leads, chat, auth, webhooks, offers
from .database import engine, Base
from .services import session_manager
import asyncio
from .services import notification_worker
from .api import admin_stats
from .api import documents
from .integrations import mpesa

Base.metadata.create_all(bind=engine)

app = FastAPI(title='Timber AI Sales Platform - Backend')

# Add CORS middleware FIRST (before any other middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Then add custom header middleware
@app.middleware('http')
async def add_cors_headers(request, call_next):
    # Handle preflight
    if request.method == 'OPTIONS':
        return Response(status_code=200, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': '*',
        })
    response = await call_next(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

app.include_router(products.router,  prefix='/products',  tags=['products'])
app.include_router(orders.router,    prefix='/orders',    tags=['orders'])
app.include_router(leads.router,     prefix='/leads',     tags=['leads'])
app.include_router(offers.router,    prefix='/offers',    tags=['offers'])
app.include_router(chat.router,      prefix='/chat',      tags=['chat'])
app.include_router(auth.router,      prefix='/auth',      tags=['auth'])
app.include_router(webhooks.router,  prefix='/webhooks',  tags=['webhooks'])

from .api import admin_sessions
app.include_router(admin_sessions.router, prefix='/admin', tags=['admin'])
app.include_router(admin_stats.router,    prefix='/admin', tags=['admin-stats'])
app.include_router(documents.router,      prefix='/documents',      tags=['documents'])
app.include_router(mpesa.router,          prefix='/payments/mpesa', tags=['mpesa'])

@app.on_event('startup')
async def start_background_tasks():
    asyncio.create_task(session_manager.session_cleaner_loop())
    # asyncio.create_task(notification_worker.worker_loop())  # Temporarily disabled - requires Redis
    # asyncio.create_task(notification_worker.retry_loop())   # Temporarily disabled - requires Redis

@app.get('/health', tags=['health'])
def health():
    return {'status': 'ok', 'service': 'elecon-backend', 'version': '1.1.0'}

@app.get('/')
def read_root():
    return {'message': 'Timber AI Sales Platform - Backend running'}
