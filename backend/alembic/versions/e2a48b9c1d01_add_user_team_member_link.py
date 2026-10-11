"""add_user_team_member_link

Revision ID: e2a48b9c1d01
Revises: d1f1356f1a35
Create Date: 2026-10-09 10:55:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e2a48b9c1d01"
down_revision: Union[str, None] = "d1f1356f1a35"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("team_member_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_users_team_member_id_team_members",
        "users",
        "team_members",
        ["team_member_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_team_member_id", "users", ["team_member_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_team_member_id", table_name="users")
    op.drop_constraint("fk_users_team_member_id_team_members", "users", type_="foreignkey")
    op.drop_column("users", "team_member_id")

