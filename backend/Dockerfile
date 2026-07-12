FROM python:3.11-slim

WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && python -m venv /opt/venv \
    && pip install --no-cache-dir uv

# Copy lock metadata first for better caching
COPY pyproject.toml uv.lock ./

# Install runtime Python dependencies from the uv lockfile
RUN uv sync --frozen --no-dev --no-group test --no-install-project

# Copy backend application code
COPY backend ./backend

# Create non-root user and switch to it
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run via startup script (handles migrations + gunicorn)
WORKDIR /app/backend
CMD ["bash", "startup.sh"]
