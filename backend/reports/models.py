from django.db import models

class Directorate(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    name = models.CharField(max_length=255)
    directorate = models.ForeignKey(Directorate, on_delete=models.CASCADE, related_name='departments')

    def __str__(self):
        return f"{self.name} ({self.directorate.name})" if self.directorate else self.name


class Office(models.Model):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='offices')

    def __str__(self):
        return f"{self.name} ({self.department.name})" if self.department else self.name
