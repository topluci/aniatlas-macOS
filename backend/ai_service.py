"""
AI Service Layer — swap providers by changing AI_PROVIDER env var.
Supported: groq (default), openrouter, ollama
"""
import os
import httpx
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

AI_PROVIDER  = os.getenv("AI_PROVIDER", "groq")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3")


def _now_str() -> str:
    """Current date and time string injected into every prompt."""
    now = datetime.now(timezone.utc)
    return now.strftime("%A, %B %d %Y at %H:%M UTC")


SYSTEM_PROMPT = """You are Hikari, an expert anime assistant built into AniSchedule.

You have the user's COMPLETE AniList data. Use it precisely.

CRITICAL RULES — VIOLATING THESE IS NOT ALLOWED:
- NEVER recommend anime from the user's COMPLETED list
- NEVER recommend anime from the user's WATCHING list
- For recommendations: ONLY suggest titles from the PRE-FILTERED RECOMMENDATIONS list or PLANNING list given below
- NEVER invent anime titles that are not in the data given to you
- NEVER fabricate scores, episode counts, genres, studios, or any details not in the data
- If no recommendations are available, say so honestly — do not make titles up
- For general knowledge questions (watch order, lore, studios) you may use your training knowledge
- Always reference actual user data when relevant
- Be concise: 2-3 paragraphs max unless listing
- Use **bold** for anime titles
- No spoilers unless asked
- For schedule questions, only use the exact airing data provided
"""


async def chat(messages: list, user_context: dict) -> str:
    system = _build_system(user_context)
    if AI_PROVIDER == "groq":
        return await _groq(system, messages)
    elif AI_PROVIDER == "openrouter":
        return await _openrouter(system, messages)
    elif AI_PROVIDER == "ollama":
        return await _ollama(system, messages)
    else:
        raise ValueError(f"Unknown AI_PROVIDER: {AI_PROVIDER}")


def _build_system(ctx: dict) -> str:
    lines = [SYSTEM_PROMPT]
    lines.append(f"\n--- CURRENT DATE & TIME ---")
    lines.append(f"Right now it is: {_now_str()}")

    lines.append(f"\n--- USER PROFILE ---")
    lines.append(f"Username: {ctx.get('username', 'Unknown')}")

    if ctx.get("favorite_genres"):
        lines.append(f"Favourite genres (most watched): {', '.join(ctx['favorite_genres'][:8])}")

    avg = ctx.get("average_score", 0)
    if avg:
        lines.append(f"Their average rating: {avg:.1f}/10")

    lines.append(f"\n--- ANIME LISTS (DO NOT RECOMMEND FROM COMPLETED OR WATCHING) ---")

    if ctx.get("watching"):
        entries = [f"{a['title']} (Ep {a.get('progress','?')}/{a.get('episodes','?')})"
                   for a in ctx["watching"]]
        lines.append(f"CURRENTLY WATCHING ({len(ctx['watching'])}): {', '.join(entries)}")

    if ctx.get("completed"):
        titles = [a["title"] for a in ctx["completed"]]
        lines.append(f"COMPLETED ({len(titles)} total) — NEVER RECOMMEND THESE: {', '.join(titles[:60])}")
        if len(titles) > 60:
            lines.append(f"  ...and {len(titles)-60} more completed anime")

    if ctx.get("planning"):
        entries = [a["title"] for a in ctx["planning"][:30]]
        lines.append(f"PLANNING TO WATCH ({len(ctx.get('planning',[]))}): {', '.join(entries)}")

    if ctx.get("paused"):
        entries = [a["title"] for a in ctx["paused"][:10]]
        lines.append(f"ON HOLD: {', '.join(entries)}")

    if ctx.get("top_rated"):
        entries = [f"{a['title']} ({a['score']}/10)" for a in ctx["top_rated"]]
        lines.append(f"\nTHEIR TOP RATED: {', '.join(entries)}")

    lines.append(f"\n--- AIRING SCHEDULE ---")
    if ctx.get("schedule_today"):
        eps = [f"{e['title']} Ep{e['episode']} at {e['time']}" for e in ctx["schedule_today"]]
        lines.append(f"AIRING TODAY: {', '.join(eps)}")
    else:
        lines.append("AIRING TODAY: Nothing scheduled today")

    if ctx.get("schedule_tomorrow"):
        eps = [f"{e['title']} Ep{e['episode']}" for e in ctx["schedule_tomorrow"]]
        lines.append(f"AIRING TOMORROW: {', '.join(eps)}")

    if ctx.get("schedule_this_week"):
        eps = [f"{e['title']} Ep{e['episode']} ({e['day']})" for e in ctx["schedule_this_week"][:10]]
        lines.append(f"THIS WEEK: {', '.join(eps)}")

    if ctx.get("recommendations"):
        lines.append(f"\n--- PRE-FILTERED RECOMMENDATIONS (safe to suggest) ---")
        for r in ctx["recommendations"][:12]:
            lines.append(
                f"• {r['title']} | Score: {r.get('mean_score','?')}/100 "
                f"| Genres: {r.get('genres','')} "
                f"| Episodes: {r.get('episodes','?')} "
                f"| {r.get('reason','')}"
            )

    return "\n".join(lines)


async def _groq(system: str, messages: list) -> str:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set in .env")
    clean = _clean_messages(messages)
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "system", "content": system}] + clean,
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        if r.status_code != 200:
            raise ValueError(f"Groq error {r.status_code}: {r.text}")
        return r.json()["choices"][0]["message"]["content"]


async def _openrouter(system: str, messages: list) -> str:
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in .env")
    clean = _clean_messages(messages)
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "system", "content": system}] + clean,
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://anischedule.app",
            },
            json=payload,
        )
        if r.status_code != 200:
            raise ValueError(f"OpenRouter error {r.status_code}: {r.text}")
        return r.json()["choices"][0]["message"]["content"]


async def _ollama(system: str, messages: list) -> str:
    clean = _clean_messages(messages)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "system", "content": system}] + clean,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        if r.status_code != 200:
            raise ValueError(f"Ollama error {r.status_code}: {r.text}")
        return r.json()["message"]["content"]


def _clean_messages(messages: list) -> list:
    """Ensure all messages have valid role and string content."""
    cleaned = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role not in ("user", "assistant"):
            role = "user"
        if not isinstance(content, str):
            content = str(content)
        if content.strip():
            cleaned.append({"role": role, "content": content})
    return cleaned
