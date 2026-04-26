"""Password hashing and validation using bcrypt."""

import bcrypt


class PasswordService:
    """Bcrypt password operations for self-hosted auth."""

    ROUNDS = 12  # ~250ms on modern hardware

    @staticmethod
    def hash_password(plain: str) -> str:
        return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=PasswordService.ROUNDS)).decode("utf-8")

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

    @staticmethod
    def validate_strength(password: str) -> list:
        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters.")
        if len(password) > 128:
            errors.append("Password must be at most 128 characters.")
        if not any(c.isupper() for c in password):
            errors.append("Must contain at least one uppercase letter.")
        if not any(c.islower() for c in password):
            errors.append("Must contain at least one lowercase letter.")
        if not any(c.isdigit() for c in password):
            errors.append("Must contain at least one digit.")
        return errors
