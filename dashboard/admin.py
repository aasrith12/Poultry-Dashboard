from django.contrib import admin

from .models import Note, Profile, UploadDataset

admin.site.register(Profile)
admin.site.register(Note)
admin.site.register(UploadDataset)
