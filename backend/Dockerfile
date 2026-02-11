FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint runtime deps
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libharfbuzz0b \
    shared-mime-info \
    # Font discovery
    fontconfig \
    libfreetype6 \
    # Fonts
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-nepali \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application"]
CMD ["celery", "-A", "config", "worker", "--loglevel=info"]
CMD ["celery", "-A", "config", "beat", "--loglevel=info"]
