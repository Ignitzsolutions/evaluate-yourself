from sqlalchemy.orm import Session
from .models import User
from datetime import datetime

def get_or_create_user(db: Session, clerk_user_id: str, email: str = None, full_name: str = None):
    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    
    if user:
        # Update last login
        user.last_login_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
        return user

    # Create new user
    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        full_name=full_name,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user