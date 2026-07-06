# ClipCut backend — FastAPI + ffmpeg, deployable to Render/Railway/Fly.
FROM python:3.11-slim

# ffmpeg (+ ffprobe) is required for all video processing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . .

# Local disk is only an ephemeral cache — the durable store is Supabase Storage.
ENV FILES_DIR=/tmp/storage \
    PYTHONUNBUFFERED=1

# Render/Railway inject $PORT.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
