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

# Patch headers to ensure service role key is properly set for RLS bypass
def _patch_supabase_headers(client: Client, service_key: str) -> None:
    """Patch Supabase client headers to ensure service role key bypasses RLS."""
    try:
        if hasattr(client, 'rest'):
            rest_client = client.rest
            
            # Try multiple paths to access the underlying HTTP session
            patched = False
            
            # Path 1: rest.postgrest.session.headers
            if hasattr(rest_client, 'postgrest'):
                postgrest = rest_client.postgrest
                if hasattr(postgrest, 'session'):
                    session = postgrest.session
                    if hasattr(session, 'headers'):
                        session.headers['apikey'] = service_key
                        session.headers['Authorization'] = f'Bearer {service_key}'
                        print("✅ Patched headers via rest.postgrest.session.headers")
                        patched = True
            
            # Path 2: rest.headers (direct)
            if not patched and hasattr(rest_client, 'headers'):
                rest_client.headers['apikey'] = service_key
                rest_client.headers['Authorization'] = f'Bearer {service_key}'
                print("✅ Patched headers via rest.headers")
                patched = True
            
            # Path 3: rest.session.headers
            if not patched and hasattr(rest_client, 'session'):
                session = rest_client.session
                if hasattr(session, 'headers'):
                    session.headers['apikey'] = service_key
                    session.headers['Authorization'] = f'Bearer {service_key}'
                    print("✅ Patched headers via rest.session.headers")
                    patched = True
            
            if not patched:
                print("⚠️ Could not patch Supabase headers - RLS bypass may not work")
    except Exception as e:
        print(f"⚠️ Error patching Supabase headers: {e}")

# Patch headers to ensure RLS bypass
_patch_supabase_headers(supabase, key)

