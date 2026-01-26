# Poultry Dashboard

Full Django rewrite of the Poultry Science Sensor Dashboard with BluConsole login and data pulls.

## Features
- BluConsole credential login (session-based)
- Dashboard pages: Home, Sensor Feed, Visualizations, AI, FAQ, Profile, Contact
- Database-backed profile, notes, and upload history

## Requirements
- Python 3.11+ (tested with 3.13)

## Setup
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run
```powershell
python manage.py makemigrations dashboard
python manage.py migrate
python manage.py runserver
```

Open `http://127.0.0.1:8000/`.
