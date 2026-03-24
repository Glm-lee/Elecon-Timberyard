TIMBER AI SALES PLATFORM — PHASE 1 PRODUCTION BLUEPRINT

This document lists the full database schema, all API endpoints, and dashboard modules for Phase 1 (Foundation).

1. Database Schema (complete)

Tables

products
- id (PK, Integer, auto-increment)
- name (String, index)
- wood_type (String, index)
- size (String)
- price (Float)
- stock_quantity (Integer, default=0)
- availability (String, default="in_stock")
- image_url (String, nullable)
- description (Text, nullable)
- created_at (DateTime, default=utcnow)
- updated_at (DateTime, default=utcnow, onupdate=utcnow)

conversation_sessions
- id (PK, Integer, auto-increment)
- customer_id (FK -> customers.id, nullable)
- channel (String)
- status (String, default="active")
- session_id (String, nullable)
- conversation_state (String, default="greeting")
- current_product (String, nullable)
- current_size (String, nullable)
- current_quantity (Integer, nullable)
- current_location (String, nullable)
- quote_amount (Float, nullable)
- last_activity (DateTime, default=utcnow)
- created_at (DateTime, default=utcnow)
- updated_at (DateTime, default=utcnow, onupdate=utcnow)

conversation_messages
- id (PK, Integer, auto-increment)
- session_id (FK -> conversation_sessions.id)
- sender (String)  # customer | assistant | admin | system
- message_text (Text)
- timestamp (DateTime, default=utcnow)
- message_type (String, default="text")  # text | quote | system_event | payment_update
- read (Boolean, default=False)

customers
- id (PK, Integer, auto-increment)
- name (String)
- phone (String, index)
- email (String, index, nullable)
- preferred_channel (String, nullable)
- location (String, nullable)
- created_at (DateTime, default=utcnow)

leads
- id (PK, Integer, auto-increment)
- customer_id (FK -> customers.id)
- source_channel (String, nullable)
- interest_level (String, default="new")  # new | cold | warm | hot
- status (String, default="new")  # new | contacted | qualified | converted | lost
- captured_at (DateTime, default=utcnow)

orders
- id (PK, Integer, auto-increment)
- customer_id (FK -> customers.id)
- total_amount (Float)
- status (String, default="pending")  # pending | confirmed | shipped | delivered | cancelled
- source_channel (String, nullable)
- delivery_location (String, nullable)
- payment_status (String, default="unpaid")  # unpaid | paid | refunded
- created_at (DateTime, default=utcnow)

order_items
- id (PK, Integer, auto-increment)
- order_id (FK -> orders.id)
- product_id (FK -> products.id)
- quantity (Integer)
- unit_price (Float)
- subtotal (Float)

conversations (legacy - may be deprecated in favor of conversation_sessions)
- id (PK, Integer, auto-increment)
- customer_id (FK -> customers.id, nullable)
- channel (String)
- conversation_history (Text)
- last_message (Text)
- last_response (Text)
- status (String, default="active")
- session_id (String, nullable)
- last_activity (DateTime, default=utcnow, onupdate=utcnow)
- conversation_state (String, default="greeting")
- current_product (String, nullable)
- current_size (String, nullable)
- current_quantity (Integer, nullable)
- current_location (String, nullable)
- quote_amount (Float, nullable)
- updated_at (DateTime, default=utcnow, onupdate=utcnow)

stock_movements
- id (PK, Integer, auto-increment)
- product_id (FK -> products.id)
- quantity_added (Integer, default=0)
- quantity_removed (Integer, default=0)
- reason (String)
- date (DateTime, default=utcnow)

admin_users
- id (PK, Integer, auto-increment)
- name (String)
- email (String, unique, index)
- password_hash (String)
- role (String)  # owner | manager | staff
- permissions (String, nullable)  # JSON string of permissions

notifications
- id (PK, Integer, auto-increment)
- session_id (Integer, nullable, index)
- event_type (String, index)
- payload (Text, default='{}')
- status (String, default='pending', index)  # pending | sent | failed
- retry_count (Integer, default=0)
- last_error (Text, nullable)
- created_at (DateTime, default=utcnow)
- delivered_at (DateTime, nullable)
- delivered_to_admin_id (Integer, nullable)

2. API Endpoints (Phase 1)

Auth Endpoints
- POST /auth/register - Register new admin user
- POST /auth/login - Login admin user, returns JWT token

Product Management
- GET /products - List all products
- POST /products - Create new product
- PUT /products/{product_id} - Update product
- DELETE /products/{product_id} - Delete product

Order Management
- GET /orders - List all orders
- POST /orders - Create new order (with customer creation if needed)
- PUT /orders/{order_id}/status - Update order status

Lead Management
- GET /leads - List all leads
- POST /leads - Create new lead (with customer creation if needed)

Chat and Conversations
- POST /chat/message - Send customer message (creates conversation)
- GET /chat/history/{customer_id} - Get conversation history for customer
- WebSocket /chat/ws/{client_id} - WebSocket for customer chat
- WebSocket /chat/ws/admin?token={jwt} - WebSocket for admin notifications

Admin Session Management
- GET /sessions?status={status}&page={page}&page_size={page_size} - List conversation sessions
- GET /sessions/{session_id}/messages?page={page}&page_size={page_size}&sort={asc|desc} - Get messages for session
- POST /sessions/{session_id}/messages/{message_id}/mark_read - Mark message as read
- POST /sessions/{session_id}/messages/send - Send admin message to session

Admin Statistics and Analytics
- GET /stats - Get dashboard statistics
- GET /stock-alerts?threshold={threshold} - Get low stock alerts
- GET /revenue-chart?days={days} - Get revenue chart data
- GET /channel-stats - Get lead source channel statistics

Webhooks and Integrations
- POST /webhooks/twilio - Handle Twilio WhatsApp webhook
- POST /webhooks/meta - Handle Meta (Facebook/Instagram) webhook

3. Dashboard Modules

Admin Dashboard (/admin)
- Login Page: Email/password login, JWT token storage
- Dashboard Overview (/admin/dashboard): 
  - Key metrics: active sessions, pending orders, total revenue, new leads today
  - Charts: revenue over time, channel distribution
  - Alerts: low stock products, pending human sessions

Inbox/Chat Center (/admin/inbox):
- Session List: Filter by status (active, pending_human), channel, lead score
- Session Details: Customer info, conversation history, current state
- Message Interface: Send messages, mark as read, view unread count
- Real-time updates via WebSocket

Leads Center (/admin/leads):
- Leads List: Filter by interest level, source, status
- Lead Details: Customer contact, conversation history
- Actions: Assign to sales, convert to order, update status

Orders Center (/admin/orders):
- Orders List: Filter by status, source, date range
- Order Details: Customer info, items, total, delivery location
- Actions: Update status, view payment status

Products Center (/admin/products):
- Products List: CRUD operations
- Product Details: Edit name, type, size, price, stock, image
- Stock Management: View stock movements, update stock

4. Security

- JWT Authentication: All admin endpoints require Bearer token
- Role-based Access: 
  - owner: full access
  - manager: most admin functions except user management
  - staff: basic admin functions
- Password Hashing: bcrypt
- Rate Limiting: Implement via middleware (e.g., FastAPI RateLimit)
- CORS: Configure for frontend domain
- Input Validation: Pydantic models for all inputs

5. Frontend Pages (Next.js)

Public Website
- Home Page (/): Hero, product gallery, trust section, contact form
- Products Page (/products): Product catalog with filters
- About Page (/about): Company story, projects, reviews
- Contact Page (/contact): Contact form, location
- Chat Widget: Floating chat button, integrated with /chat/ws

Admin Dashboard (Separate Route /admin)
- Layout: Sidebar navigation, header with user info
- Responsive Design: Mobile-friendly
- Real-time Updates: WebSocket connections for live data

6. Hosting and Deployment

- Frontend: Vercel (Next.js optimized)
- Backend: Render or DigitalOcean App Platform
- Database: Supabase (PostgreSQL) or managed PostgreSQL
- Environment Variables: Secure storage for API keys, secrets
- SSL: Automatic on hosting platforms

7. Next Steps to Phase 2

- Implement AI Engine: OpenAI integration for conversation responses
- Add Chat Widget: Embeddable widget for public site
- Quotation Engine: Dynamic pricing based on location, quantity
- Lead Qualification: AI scoring and routing
- Social Integrations: Facebook Messenger, Instagram DM via Meta Graph API