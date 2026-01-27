# backend/db/models.py
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.sqlite import BLOB
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, index=True)
    full_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), onupdate=func.now())
