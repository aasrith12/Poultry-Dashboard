from __future__ import annotations

import json
from typing import Any

from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import redirect, render
from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import Note, Profile, UploadDataset
from .services import bluconsole
from .utils.blu_xml import parse_devices, parse_measurements


def _owner_key(request) -> str:
    return request.session.get("owner_key") or "guest"


def _set_owner_key(request, key: str) -> None:
    request.session["owner_key"] = key


def _blu_creds(request) -> dict | None:
    return request.session.get("blu_creds")


def _require_blu(view_func):
    def wrapper(request, *args, **kwargs):
        if not _blu_creds(request):
            return redirect(f"/login/?next={request.path}")
        return view_func(request, *args, **kwargs)

    return wrapper


def _json_body(request) -> dict[str, Any]:
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {}


@ensure_csrf_cookie
def home(request):
    profile = Profile.objects.filter(owner_key=_owner_key(request)).first()
    return render(request, "dashboard/home.html", {"profile": profile})


@ensure_csrf_cookie
def faq(request):
    return render(request, "dashboard/faq.html")


@ensure_csrf_cookie
def login_view(request):
    return render(request, "dashboard/login.html")


@ensure_csrf_cookie
def signup(request):
    return render(request, "dashboard/signup.html")


@ensure_csrf_cookie
def profile(request):
    return render(request, "dashboard/profile.html")


@ensure_csrf_cookie
@_require_blu
def sensor_feed(request):
    return render(request, "dashboard/sensor_feed.html")


@ensure_csrf_cookie
@_require_blu
def visualizations(request):
    return render(request, "dashboard/visualizations.html")


@ensure_csrf_cookie
@_require_blu
def ai(request):
    return render(request, "dashboard/ai.html")


@ensure_csrf_cookie
@_require_blu
def ai_chat(request):
    return render(request, "dashboard/ai_chat.html")


@ensure_csrf_cookie
def contact(request):
    return render(request, "dashboard/contact.html")


@require_http_methods(["POST"])
def api_blu_login(request):
    data = _json_body(request)
    uname = (data.get("uname") or "").strip()
    upass = (data.get("upass") or "").strip()
    if not uname or not upass:
        return JsonResponse({"error": "Missing credentials"}, status=400)
    try:
        bluconsole.blu_login(uname, upass)
    except Exception as exc:  # noqa: BLE001
        return JsonResponse({"error": str(exc)}, status=401)
    request.session["blu_creds"] = {"uname": uname, "upass": upass}
    return JsonResponse({"ok": True})


@require_http_methods(["POST"])
def api_blu_logout(request):
    request.session.pop("blu_creds", None)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def api_blu_status(request):
    creds = _blu_creds(request)
    return JsonResponse({"authenticated": bool(creds)})


@require_http_methods(["GET"])
def api_blu_devices(request):
    creds = _blu_creds(request)
    if not creds:
        return JsonResponse({"error": "Not authenticated"}, status=401)
    try:
        xml = bluconsole.get_devices(creds["uname"], creds["upass"], children=False)
        devices = parse_devices(xml)
        return JsonResponse({"devices": devices})
    except Exception as exc:  # noqa: BLE001
        return JsonResponse({"error": str(exc)}, status=502)


@require_http_methods(["GET"])
def api_blu_measurements(request):
    creds = _blu_creds(request)
    if not creds:
        return JsonResponse({"error": "Not authenticated"}, status=401)
    device_id = request.GET.get("id") or None
    from_time = request.GET.get("fromTime")
    to_time = request.GET.get("toTime")
    include_all = request.GET.get("includeAll") == "true"
    try:
        xml = bluconsole.get_measurements(
            creds["uname"],
            creds["upass"],
            device_id=device_id,
            from_time=int(from_time) if from_time else None,
            to_time=int(to_time) if to_time else None,
            include_all=include_all,
        )
        points = parse_measurements(xml, device_id=device_id)
        return JsonResponse({"points": points})
    except Exception as exc:  # noqa: BLE001
        return JsonResponse({"error": str(exc)}, status=502)


@require_http_methods(["POST"])
def api_signup(request):
    data = _json_body(request)
    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"error": "Email is required"}, status=400)
    first_name = (data.get("firstName") or "").strip()
    last_name = (data.get("lastName") or "").strip()
    profile, _ = Profile.objects.get_or_create(owner_key=email)
    profile.email = email
    profile.first_name = first_name
    profile.last_name = last_name
    profile.save()
    _set_owner_key(request, email)
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "POST"])
def api_profile(request):
    owner_key = _owner_key(request)
    if request.method == "GET":
        profile = Profile.objects.filter(owner_key=owner_key).first()
        if not profile:
            return JsonResponse({"profile": None})
        return JsonResponse(
            {
                "profile": {
                    "firstName": profile.first_name,
                    "lastName": profile.last_name,
                    "email": profile.email,
                    "photoDataUrl": profile.photo_data_url,
                }
            }
        )
    data = _json_body(request)
    profile, _ = Profile.objects.get_or_create(owner_key=owner_key)
    profile.first_name = (data.get("firstName") or "").strip()
    profile.last_name = (data.get("lastName") or "").strip()
    profile.email = (data.get("email") or profile.email or "").strip()
    profile.photo_data_url = data.get("photoDataUrl") or ""
    profile.save()
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "POST"])
def api_notes(request):
    owner_key = _owner_key(request)
    if request.method == "GET":
        notes = (
            Note.objects.filter(owner_key=owner_key)
            .order_by("-updated_at", "-created_at")
            .values("id", "title", "body", "created_at", "updated_at")
        )
        return JsonResponse({"notes": list(notes)})
    data = _json_body(request)
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    if not title or not body:
        return JsonResponse({"error": "Title and body are required"}, status=400)
    note = Note.objects.create(owner_key=owner_key, title=title, body=body)
    return JsonResponse({"note": {"id": note.id, "title": note.title, "body": note.body}})


@require_http_methods(["PUT", "DELETE"])
def api_note_detail(request, note_id: int):
    owner_key = _owner_key(request)
    note = Note.objects.filter(owner_key=owner_key, id=note_id).first()
    if not note:
        return JsonResponse({"error": "Not found"}, status=404)
    if request.method == "DELETE":
        note.delete()
        return JsonResponse({"ok": True})
    data = _json_body(request)
    note.title = (data.get("title") or note.title).strip()
    note.body = (data.get("body") or note.body).strip()
    note.updated_at = timezone.now()
    note.save(update_fields=["title", "body", "updated_at"])
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "POST"])
def api_uploads(request):
    owner_key = _owner_key(request)
    if request.method == "GET":
        uploads = (
            UploadDataset.objects.filter(owner_key=owner_key)
            .order_by("-created_at")
            .values("id", "name", "row_count", "created_at")
        )
        return JsonResponse({"uploads": list(uploads)})
    data = _json_body(request)
    name = (data.get("name") or "").strip()
    headers = data.get("headers") or []
    rows = data.get("rows") or []
    if not name:
        return JsonResponse({"error": "Name is required"}, status=400)
    upload = UploadDataset.objects.create(
        owner_key=owner_key,
        name=name,
        headers=headers,
        rows=rows,
        row_count=len(rows),
    )
    return JsonResponse({"upload": {"id": upload.id}})


@require_http_methods(["DELETE"])
def api_uploads_clear(request):
    owner_key = _owner_key(request)
    UploadDataset.objects.filter(owner_key=owner_key).delete()
    return JsonResponse({"ok": True})


@require_http_methods(["GET", "DELETE"])
def api_upload_detail(request, upload_id: int):
    owner_key = _owner_key(request)
    upload = UploadDataset.objects.filter(owner_key=owner_key, id=upload_id).first()
    if not upload:
        return JsonResponse({"error": "Not found"}, status=404)
    if request.method == "DELETE":
        upload.delete()
        return JsonResponse({"ok": True})
    return JsonResponse(
        {
            "upload": {
                "id": upload.id,
                "name": upload.name,
                "headers": upload.headers,
                "rows": upload.rows,
                "row_count": upload.row_count,
                "created_at": upload.created_at,
            }
        }
    )


@require_http_methods(["POST"])
def api_ai_chat(request):
    if not settings.OPENAI_API_KEY:
        return JsonResponse({"error": "OPENAI_API_KEY not configured"}, status=400)
    data = _json_body(request)
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return JsonResponse({"error": "Prompt is required"}, status=400)
    # Placeholder response; wire OpenAI client later.
    return JsonResponse(
        {
            "answer": "OpenAI is configured. This is a placeholder response until the LLM is connected."
        }
    )


@require_http_methods(["GET"])
def api_ai_chat_status(request):
    return JsonResponse(
        {
            "connected": bool(settings.OPENAI_API_KEY),
            "provider": "openai",
        }
    )
