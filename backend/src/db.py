import os
from urllib.parse import urlparse

from supabase import create_client
import config

_client = None


def _bypass_proxy_for_supabase():
    host = urlparse(config.SUPABASE_URL).hostname
    if not host:
        return
    existing = os.environ.get('NO_PROXY', '') or os.environ.get('no_proxy', '')
    parts = [p.strip() for p in existing.split(',') if p.strip()]
    if host not in parts:
        parts.append(host)
    value = ','.join(parts)
    os.environ['NO_PROXY'] = value
    os.environ['no_proxy'] = value


def get_db():
    global _client
    if _client is None:
        _bypass_proxy_for_supabase()
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return _client
