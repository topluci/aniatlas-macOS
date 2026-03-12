"""
This script patches your existing server.py to add the chat endpoint.
Run: python3 server_patch.py ~/Downloads/AniSchedule-macOS/backend/server.py
"""
import sys, re

if len(sys.argv) < 2:
    print("Usage: python3 server_patch.py <path_to_server.py>")
    sys.exit(1)

path = sys.argv[1]
with open(path, "r") as f:
    src = f.read()

# ── 1. Add imports after existing imports ────────────────────────────────────
AI_IMPORTS = """
# AI Chat
import time as _time
from ai_service import chat as ai_chat
from recommendation_engine import build_user_context
"""

# ── 2. Add cache helpers after imports ───────────────────────────────────────
CACHE_CODE = """
# ── In-memory response cache ─────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 20 * 60  # 20 minutes

def _cache_get(key):
    entry = _cache.get(key)
    if entry and _time.time() < entry[1]:
        return entry[0]
    return None

def _cache_set(key, val, ttl=CACHE_TTL):
    _cache[key] = (val, _time.time() + ttl)
"""

# ── 3. Chat endpoint ──────────────────────────────────────────────────────────
CHAT_ENDPOINT = """

# ── AI Chat endpoint ──────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list  # [{"role": "user"|"assistant", "content": str}]

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    \"\"\"AI assistant — injects user AniList context then calls AI provider.\"\"\"
    try:
        uid = str(current_user.get("id") or current_user.get("username", ""))
        cache_key = f"ctx_{uid}"

        cached = _cache_get(cache_key)
        if cached:
            anime_list, schedules = cached
        else:
            # Re-use existing fetch logic via the list/schedule endpoints internals
            token = current_user.get("access_token", "")
            platform = current_user.get("platform", "anilist")
            anime_list = await _fetch_list_for_chat(current_user)
            schedules  = await _fetch_schedules_for_chat(current_user)
            _cache_set(cache_key, (anime_list, schedules))

        user_context = build_user_context(
            anime_list=anime_list,
            schedules=schedules,
            username=current_user.get("username", ""),
        )

        reply = await ai_chat(req.messages, user_context)
        return {"reply": reply}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI service unavailable: {str(e)}")


async def _fetch_list_for_chat(user: dict) -> list:
    \"\"\"Fetch anime list entries for chat context.\"\"\"
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        # Try to get from DB cache first
        db_entries = await db.anime_entries.find(
            {"user_id": str(user.get("id") or user.get("username"))}
        ).to_list(length=1000)
        if db_entries:
            return db_entries
    except Exception:
        pass
    return []


async def _fetch_schedules_for_chat(user: dict) -> list:
    \"\"\"Fetch schedule entries for chat context.\"\"\"
    try:
        db_entries = await db.schedules.find(
            {"user_id": str(user.get("id") or user.get("username"))}
        ).to_list(length=200)
        if db_entries:
            return db_entries
    except Exception:
        pass
    return []
"""

# Apply patches
modified = src

# Add AI imports before first @app route or before app = FastAPI
if "# AI Chat" not in modified:
    # Insert after last import block
    insert_after = "from fastapi.middleware.cors"
    if insert_after in modified:
        idx = modified.rfind("\n", 0, modified.find(insert_after)) + 1
        end_of_line = modified.find("\n", modified.find(insert_after)) + 1
        modified = modified[:end_of_line] + AI_IMPORTS + modified[end_of_line:]
    else:
        modified = AI_IMPORTS + "\n" + modified

# Add cache code before app = FastAPI(
if "_cache: dict" not in modified:
    marker = "app = FastAPI("
    if marker in modified:
        idx = modified.find(marker)
        modified = modified[:idx] + CACHE_CODE + "\n" + modified[idx:]

# Add chat endpoint at end of file
if "@app.post(\"/api/chat\")" not in modified:
    modified = modified + "\n" + CHAT_ENDPOINT

with open(path, "w") as f:
    f.write(modified)

print(f"✅ Patched {path}")
print("   Added: imports, cache helpers, /api/chat endpoint")
