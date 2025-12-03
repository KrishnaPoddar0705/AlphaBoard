import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")

# Try both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY for compatibility
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")

if not key:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY must be set in environment variables")

print(f"Supabase URL: {url}")
print(f"Using service key: {key[:20]}...{key[-10:] if len(key) > 30 else key[-5:]}")
print(f"Key length: {len(key)}")

# Create client with service role key
# The Python client doesn't need options for service role - it automatically bypasses RLS
supabase: Client = create_client(url, key)

