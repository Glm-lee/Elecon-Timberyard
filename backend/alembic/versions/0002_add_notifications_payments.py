"""Add notifications and payments tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-19 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision      = '0002'
down_revision = '0001'
branch_labels = None
depends_on    = None

def upgrade():
    op.create_table('notifications',
        sa.Column('id',           sa.Integer(),  primary_key=True),
        sa.Column('session_id',   sa.Integer(),  nullable=True),
        sa.Column('event_type',   sa.String(50), nullable=False),
        sa.Column('payload',      sa.Text(),     nullable=False, server_default='{}'),
        sa.Column('status',       sa.String(20), nullable=False, server_default='pending'),
        sa.Column('retry_count',  sa.Integer(),  nullable=False, server_default='0'),
        sa.Column('last_error',   sa.Text(),     nullable=True),
        sa.Column('created_at',   sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at',   sa.DateTime(), nullable=True),
        sa.Column('delivered_to_admin_id', sa.Integer(), nullable=True),
    )
    op.create_index('ix_notifications_status',     'notifications', ['status'])
    op.create_index('ix_notifications_event_type', 'notifications', ['event_type'])
    op.create_index('ix_notifications_session_id', 'notifications', ['session_id'])
    op.create_table('payments',
        sa.Column('id',                   sa.Integer(),   primary_key=True),
        sa.Column('order_id',             sa.Integer(),   nullable=True),
        sa.Column('merchant_request_id',  sa.String(100), nullable=True),
        sa.Column('checkout_request_id',  sa.String(100), nullable=True),
        sa.Column('mpesa_receipt',        sa.String(100), nullable=True),
        sa.Column('phone',                sa.String(20),  nullable=True),
        sa.Column('amount',               sa.Float(),     nullable=False, server_default='0'),
        sa.Column('status',               sa.String(30),  nullable=False, server_default='pending'),
        sa.Column('result_code',          sa.String(10),  nullable=True),
        sa.Column('result_desc',          sa.String(200), nullable=True),
        sa.Column('initiated_at',         sa.DateTime(),  nullable=True),
        sa.Column('completed_at',         sa.DateTime(),  nullable=True),
        sa.Column('raw_callback',         sa.String(4000), nullable=True),
    )
    op.create_index('ix_payments_order_id', 'payments', ['order_id'])
    op.create_index('ix_payments_status',   'payments', ['status'])
    op.create_table('conversations',
        sa.Column('id',                   sa.Integer(),  primary_key=True),
        sa.Column('customer_id',          sa.Integer(),  nullable=True),
        sa.Column('channel',              sa.String(),   nullable=True),
        sa.Column('conversation_history', sa.Text(),     nullable=True),
        sa.Column('last_message',         sa.Text(),     nullable=True),
        sa.Column('last_response',        sa.Text(),     nullable=True),
        sa.Column('status',               sa.String(),   nullable=True),
        sa.Column('session_id',           sa.String(),   nullable=True),
        sa.Column('last_activity',        sa.DateTime(), nullable=True),
        sa.Column('conversation_state',   sa.String(),   nullable=True),
        sa.Column('current_product',      sa.String(),   nullable=True),
        sa.Column('current_size',         sa.String(),   nullable=True),
        sa.Column('current_quantity',     sa.Integer(),  nullable=True),
        sa.Column('current_location',     sa.String(),   nullable=True),
        sa.Column('quote_amount',         sa.Float(),    nullable=True),
        sa.Column('updated_at',           sa.DateTime(), nullable=True),
    )
    op.create_table('stock_movements',
        sa.Column('id',               sa.Integer(),  primary_key=True),
        sa.Column('product_id',       sa.Integer(),  nullable=True),
        sa.Column('quantity_added',   sa.Integer(),  nullable=True),
        sa.Column('quantity_removed', sa.Integer(),  nullable=True),
        sa.Column('reason',           sa.String(),   nullable=True),
        sa.Column('date',             sa.DateTime(), nullable=True),
    )

def downgrade():
    op.drop_index('ix_payments_status',   'payments')
    op.drop_index('ix_payments_order_id', 'payments')
    op.drop_table('payments')
    op.drop_index('ix_notifications_session_id', 'notifications')
    op.drop_index('ix_notifications_event_type', 'notifications')
    op.drop_index('ix_notifications_status',     'notifications')
    op.drop_table('notifications')
    op.drop_table('conversations')
    op.drop_table('stock_movements')
