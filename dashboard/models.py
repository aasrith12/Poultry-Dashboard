from django.db import models


class Profile(models.Model):
    owner_key = models.CharField(max_length=255, unique=True)
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    photo_data_url = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.owner_key} profile"


class Note(models.Model):
    owner_key = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.owner_key}: {self.title}"


class UploadDataset(models.Model):
    owner_key = models.CharField(max_length=255, db_index=True)
    name = models.CharField(max_length=255)
    headers = models.JSONField(default=list)
    rows = models.JSONField(default=list)
    row_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.owner_key}: {self.name}"
