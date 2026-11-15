"""add cards table

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-01 02:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('card_number_masked', sa.String(length=32), nullable=False),
        sa.Column('card_type', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('daily_limit', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('current_day_spend', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('international_enabled', sa.Boolean(), nullable=False),
        sa.Column('online_enabled', sa.Boolean(), nullable=False),
        sa.Column('last_freeze_reason', sa.String(length=255), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.CheckConstraint("status IN ('active', 'frozen', 'blocked')", name=op.f('ck_cards_card_status_valid')),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name=op.f('fk_cards_customer_id_customers')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cards')),
        sa.UniqueConstraint('customer_id', name=op.f('uq_cards_customer_id'))
    )
    with op.batch_alter_table('cards', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_cards_customer_id'), ['customer_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('cards', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_cards_customer_id'))
    op.drop_table('cards')
