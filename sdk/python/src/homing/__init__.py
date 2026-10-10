"""Python client for the Homing email API.

import homing

client = homing.Client("hom_...")
resp = client.emails.send({
    "from": "Acme <onboarding@homing.dev>",
    "to": "user@example.com",
    "subject": "Hello World",
    "html": "<strong>It works!</strong>",
})
"""

from .client import DEFAULT_BASE_URL, VERSION, Client, HomingError
from .emails import (
    MAX_BATCH_SIZE,
    Email,
    Emails,
    EmailStatus,
    SendEmailRequest,
    SendEmailResponse,
)

__version__ = VERSION

__all__ = [
    "DEFAULT_BASE_URL",
    "MAX_BATCH_SIZE",
    "Client",
    "Email",
    "EmailStatus",
    "Emails",
    "SendEmailRequest",
    "SendEmailResponse",
    "HomingError",
]
