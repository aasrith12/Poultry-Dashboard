# Poultry Dashboard

A Django-based cold-chain monitoring dashboard for poultry workflows, connected to BluConsole logger data and enhanced with AI-assisted shelf-life analysis.

## What This App Does

- Authenticates users against BluConsole (session-based).
- Pulls live logger measurements and device status.
- Supports `.xlsx` upload history and visualization.
- Calculates shelf-life estimates across multiple models:
  - FEFO (Monte Carlo proxy)
  - Avg Temp + Q10
  - Q10 Integrated
  - Arrhenius Integrated
  - MKT + Q10
  - MKT + Arrhenius
- Provides an AI chat assistant with optional Excel attachment summaries.

## Tech Stack

- Python 3.11+ (tested with 3.13)
- Django 6
- OpenPyXL
- WhiteNoise (static serving)
- PostgreSQL/SQLite via `dj-database-url`

## Project Structure

```text
.
|-- dashboard/                # App templates, static assets, views, models, APIs
|-- poultry_dashboard/        # Django project settings/urls/asgi/wsgi
|-- manage.py
|-- requirements.txt
`-- README.md
```

## Quick Start (Local)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py makemigrations dashboard
python manage.py migrate
python manage.py runserver
```

Open: `http://127.0.0.1:8000/`

## Configuration

The app reads environment variables from:
- OS environment
- `.env` (project root)
- `openAI.env` (project root)

### Common Variables

```env
DEBUG=true
SECRET_KEY=change-me
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=sqlite:///db.sqlite3
BLU_BASE=https://http-receiver.bluconsole.com
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Notes:
- `OPENAI_API_KEY` is required for AI chat features.
- If `DEBUG=false`, set a real `SECRET_KEY` and proper host/origin values.

## Main Pages

- `/` Home
- `/sensor-feed/` Logger list and upload entry point
- `/visualizations/` Live and uploaded chart views
- `/ai/` Shelf-life model analysis and trend charts
- `/ai-chat/` AI assistant chat
- `/faq/`, `/profile/`, `/contact/`

## API Endpoints (Summary)

### BluConsole
- `GET /api/blu/status/`
- `POST /api/blu/login/`
- `POST /api/blu/logout/`
- `GET /api/blu/devices/`
- `GET /api/blu/measurements/`

### App Data
- `POST /api/signup/`
- `GET|POST /api/profile/`
- `GET|POST /api/notes/`
- `PUT|DELETE /api/notes/<note_id>/`
- `GET|POST /api/uploads/`
- `DELETE /api/uploads/clear/`
- `GET|DELETE /api/uploads/<upload_id>/`

### AI Chat
- `POST /api/ai-chat/`
- `GET /api/ai-chat/status/`
- `GET /api/ai-chat/sessions/`
- `GET /api/ai-chat/sessions/<session_id>/`
- `DELETE /api/ai-chat/sessions/clear/`
- `POST /api/ai-chat/attachment/`

## Deployment Notes

- `Procfile` and `railway.json` are included for Railway-style deployments.
- Static assets are served via WhiteNoise.
- Configure `DATABASE_URL`, `ALLOWED_HOSTS`, and `CSRF_TRUSTED_ORIGINS` for production.

## Troubleshooting

- **Excel upload fails**: Use `.xlsx` (not legacy `.xls`).
- **AI chat unavailable**: Verify `OPENAI_API_KEY` is set.
- **No BluConsole data**: Re-check BluConsole credentials and logger ID/time range.
