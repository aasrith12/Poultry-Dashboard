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

## Reviewer / demo login

For reviewers who do not have BluConsole credentials, local demo login is enabled when `DEBUG=1`.

```text
Username: demo
Password: demo
```

The demo login uses generated sample devices and measurements, so Sensor Feed, Visualizations, AI Estimation, and AI ChatBot can be examined without contacting BluConsole.

To disable it, set:

```powershell
$env:DEMO_LOGIN_ENABLED="0"
```
