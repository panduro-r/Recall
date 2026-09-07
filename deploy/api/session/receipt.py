"""File-based endpoint; shared adapter retains host, origin and body guards."""
from hosted_app import handler as RecallHandler


class handler(RecallHandler):
    endpoint = "/api/session/receipt"
