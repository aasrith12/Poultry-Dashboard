web: python manage.py migrate && python manage.py collectstatic --noinput && gunicorn poultry_dashboard.wsgi:application --bind 0.0.0.0:$PORT
