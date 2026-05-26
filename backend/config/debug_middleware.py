import logging

logger = logging.getLogger(__name__)

class DebugRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if 'approve' in request.path:
            print(f"DEBUG: [Request] {request.method} {request.path}", flush=True)
            print(f"DEBUG: [Headers] {request.headers}", flush=True)
            content_length = request.headers.get('Content-Length', 'unknown')
            print(f"DEBUG: [Request Content-Length] {content_length}", flush=True)
        
        response = self.get_response(request)
        
        if 'approve' in request.path:
            print(f"DEBUG: [Response] Status: {response.status_code}, Length: {len(response.content) if hasattr(response, 'content') else 'unknown'}", flush=True)
            
        return response
