from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from ..database import Base
import datetime

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    wood_type = Column(String, index=True)
    size = Column(String)
    price = Column(Float)
    stock_quantity = Column(Integer, default=0)
    availability = Column(String, default="in_stock")
    image_url = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    channel = Column(String)
    status = Column(String, default="active")
    session_id = Column(String, nullable=True)
    conversation_state = Column(String, default="greeting")
    current_product = Column(String, nullable=True)
    current_size = Column(String, nullable=True)
    current_quantity = Column(Integer, nullable=True)
    current_location = Column(String, nullable=True)
    quote_amount = Column(Float, nullable=True)
    last_activity = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("conversation_sessions.id"))
    sender = Column(String)  # customer | assistant | admin | system
    message_text = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    message_type = Column(String, default="text")  # text | quote | system_event | payment_update
    read = Column(Boolean, default=False)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    phone = Column(String, index=True)
    email = Column(String, index=True)
    preferred_channel = Column(String)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    source_channel = Column(String)
    interest_level = Column(String)
    status = Column(String, default="new")
    captured_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    total_amount = Column(Float)
    status = Column(String, default="pending")
    source_channel = Column(String)
    delivery_location = Column(String)
    payment_status = Column(String, default="unpaid")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    unit_price = Column(Float)
    subtotal = Column(Float)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    channel = Column(String)
    conversation_history = Column(Text)
    last_message = Column(Text)
    last_response = Column(Text)
    # sessioning fields
    status = Column(String, default="active")
    session_id = Column(String, nullable=True)
    last_activity = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    conversation_state = Column(String, default="greeting")
    current_product = Column(String, nullable=True)
    current_size = Column(String, nullable=True)
    current_quantity = Column(Integer, nullable=True)
    current_location = Column(String, nullable=True)
    quote_amount = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity_added = Column(Integer, default=0)
    quantity_removed = Column(Integer, default=0)
    reason = Column(String)
    date = Column(DateTime, default=datetime.datetime.utcnow)

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)
    permissions = Column(String)
