class StructuredError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: list[str] | None = None, request_id: str | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []
        self.request_id = request_id
