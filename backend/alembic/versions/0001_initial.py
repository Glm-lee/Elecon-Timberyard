"""initial

Revision ID: 0001
Revises: 
Create Date: 2026-03-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Products
    op.create_table('products',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('wood_type', sa.String(), nullable=True),
        sa.Column('size', sa.String(), nullable=True),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('stock_quantity', sa.Integer(), nullable=True),
        sa.Column('availability', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    # Customers
    op.create_table('customers',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('preferred_channel', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    # Conversation sessions
    op.create_table('conversation_sessions',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('channel', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('conversation_state', sa.String(), nullable=True),
        sa.Column('current_product', sa.String(), nullable=True),
        sa.Column('current_size', sa.String(), nullable=True),
        sa.Column('current_quantity', sa.Integer(), nullable=True),
        sa.Column('current_location', sa.String(), nullable=True),
        sa.Column('quote_amount', sa.Float(), nullable=True),
        sa.Column('last_activity', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    # Conversation messages
    op.create_table('conversation_messages',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('sender', sa.String(), nullable=True),
        sa.Column('message_text', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('message_type', sa.String(), nullable=True),
        sa.Column('read', sa.Boolean(), nullable=True),
    )
    # Leads
    op.create_table('leads',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('source_channel', sa.String(), nullable=True),
        sa.Column('interest_level', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=True),
    )
    # Orders and items
    op.create_table('orders',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('total_amount', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('source_channel', sa.String(), nullable=True),
        sa.Column('delivery_location', sa.String(), nullable=True),
        sa.Column('payment_status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_table('order_items',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('unit_price', sa.Float(), nullable=True),
        sa.Column('subtotal', sa.Float(), nullable=True),
    )
    # Admin users
    op.create_table('admin_users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('permissions', sa.String(), nullable=True),
    )

def downgrade():
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('leads')
    op.drop_table('conversation_messages')
    op.drop_table('conversation_sessions')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_table('admin_users')
