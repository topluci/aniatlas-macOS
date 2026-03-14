from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, Depends
from fastapi.responses import RedirectResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import aiohttp
import jwt
import secrets
import hashlib
# ics removed
import io
import asyncio
from functools import lru_cache
import time
import re
from pywebpush import webpush, WebPushException
import json
import time as _time
try:
    from ai_service import chat as ai_chat
    from recommendation_engine import build_user_context
    AI_ENABLED = True
    print("[AI] Loaded OK")
except Exception as _e:
    AI_ENABLED = False
    ai_chat = None
    build_user_context = None
    print(f"[AI] Failed to load: {_e}")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# AniList Config
ANILIST_CLIENT_ID = os.environ.get('ANILIST_CLIENT_ID')
ANILIST_CLIENT_SECRET = os.environ.get('ANILIST_CLIENT_SECRET')
ANILIST_REDIRECT_URI = os.environ.get('ANILIST_REDIRECT_URI')
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-change-me')
ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"
ANILIST_TOKEN_URL = "https://anilist.co/api/v2/oauth/token"

# MAL Config
MAL_CLIENT_ID = os.environ.get('MAL_CLIENT_ID')
MAL_CLIENT_SECRET = os.environ.get('MAL_CLIENT_SECRET')
MAL_REDIRECT_URI = os.environ.get('MAL_REDIRECT_URI')
MAL_API_URL = "https://api.myanimelist.net/v2"
MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token"

# External APIs
ANIMESCHEDULE_API = "https://animeschedule.net/api/v3"
JIKAN_API = "https://api.jikan.moe/v4"

# VAPID keys for push notifications (generated once and stored)
# In production, these should be stored in environment variables
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', 'cPbL0I3vJh1kpT5x_VvZqJ8yVqQKJ6QQxPNQyR1lHrQ')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', 'BK7MKLhRRqvVqPPXEP5h7MHjcf8VqXvPMFQI-L4fNSj4UVQK8pKQpQ3OQiJaQQGJRfCYqB5j7QpYQGKQfFQmQKQ')
VAPID_CLAIMS = {"sub": "mailto:notifications@anischedule.app"}

# Anime abbreviation aliases for natural language search
ANIME_ALIASES: Dict[str, List[str]] = {
    # Meta / intent keywords
    "recommend": ["recommendation"],
    "suggest": ["recommendation"],
    "what should i watch": ["recommendation"],
    "something to watch": ["recommendation"],
    # Artist search intent
    "by": ["artist"],
    "songs by": ["artist"],
    "music by": ["artist"],
    "artist": ["artist"],
    "singer": ["artist"],
    "band": ["artist"],
    # Character search intent
    "character": ["character"],
    "voiced by": ["voice actor"],
    "va": ["voice actor"],
    "cv": ["voice actor"],
    "aot": ["attack on titan", "shingeki no kyojin"],
    "snk": ["attack on titan", "shingeki no kyojin"],
    "mha": ["my hero academia", "boku no hero academia"],
    "bnha": ["my hero academia", "boku no hero academia"],
    "jjk": ["jujutsu kaisen"],
    "fmab": ["fullmetal alchemist brotherhood"],
    "fma": ["fullmetal alchemist"],
    "opm": ["one punch man"],
    "op": ["one piece"],
    "hxh": ["hunter x hunter"],
    "ds": ["demon slayer", "kimetsu no yaiba"],
    "kny": ["demon slayer", "kimetsu no yaiba"],
    "sao": ["sword art online"],
    "rezero": ["re:zero"],
    "konosuba": ["kono subarashii sekai ni shukufuku wo"],
    "mob": ["mob psycho 100"],
    "csm": ["chainsaw man"],
    "spy x family": ["spy x family"],
    "spyxfamily": ["spy x family"],
    "bc": ["black clover"],
    "aob": ["ao no blue exorcist", "blue exorcist"],
    "bnp": ["bunny girl senpai", "rascal does not dream of bunny girl senpai"],
    "bunny girl": ["rascal does not dream of bunny girl senpai"],
    "danmachi": ["is it wrong to try to pick up girls in a dungeon"],
    "oregairu": ["my teen romantic comedy snafu"],
    "snafu": ["my teen romantic comedy snafu"],
    "tpn": ["the promised neverland", "yakusoku no neverland"],
    "yno": ["your name", "kimi no na wa"],
    "knnw": ["your name", "kimi no na wa"],
    "ttgl": ["tengen toppa gurren lagann", "gurren lagann"],
    "gurren lagann": ["tengen toppa gurren lagann"],
    "eva": ["neon genesis evangelion", "evangelion"],
    "nge": ["neon genesis evangelion"],
    "dbz": ["dragon ball z"],
    "dbs": ["dragon ball super"],
    "yyh": ["yu yu hakusho"],
    "ib": ["isekai wa smartphone", "in another world with my smartphone"],
    "slime": ["that time i got reincarnated as a slime", "tensei shitara slime datta ken"],
    "mushoku": ["mushoku tensei", "jobless reincarnation"],
    "jobless": ["mushoku tensei", "jobless reincarnation"],
    "made in abyss": ["made in abyss"],
    "mia": ["made in abyss"],
    "vinland": ["vinland saga"],
    "steins gate": ["steins;gate"],
    "steinsgate": ["steins;gate"],
    "sg": ["steins;gate"],
    "code geass": ["code geass"],
    "cg": ["code geass"],
    "death note": ["death note"],
    "dn": ["death note"],
    "tokyo ghoul": ["tokyo ghoul"],
    "tg": ["tokyo ghoul"],
    "shield hero": ["the rising of the shield hero", "tate no yuusha no nariagari"],
    "overlord": ["overlord"],
    "solo leveling": ["solo leveling"],
    "sl": ["solo leveling"],
    "frieren": ["frieren", "sousou no frieren"],
    "oshi no ko": ["oshi no ko"],
    "onk": ["oshi no ko"],
    "bocchi": ["bocchi the rock"],
    "lycoris": ["lycoris recoil"],
    "eminence": ["the eminence in shadow"],
    "blue lock": ["blue lock"],
    "bl": ["blue lock"],
    "dandadan": ["dandadan"],
    "kaiju": ["kaiju no 8"],
    "kaiju8": ["kaiju no 8"],
    "k8": ["kaiju no 8"],
    "narutoo": ["naruto"],
    "naruto": ["naruto"],
    "boruto": ["boruto"],
    "bleach": ["bleach"],
    "tybw": ["bleach thousand year blood war"],
    "fairy tail": ["fairy tail"],
    "ft": ["fairy tail"],
    "nana": ["nana"],
    "clannad": ["clannad"],
    "anohana": ["anohana", "ano hi mita hana"],
    "your lie": ["your lie in april", "shigatsu wa kimi no uso"],
    "shigatsu": ["your lie in april", "shigatsu wa kimi no uso"],
    "violet evergarden": ["violet evergarden"],
    "ve": ["violet evergarden"],
    "re zero": ["re:zero"],
    "rezero": ["re:zero"],
    "rwby": ["rwby"],
    "sao": ["sword art online"],
    "sao alicization": ["sword art online alicization"],
    "alicization": ["sword art online alicization"],
    "nisekoi": ["nisekoi"],
    "monogatari": ["monogatari series", "bakemonogatari"],
    "bake": ["bakemonogatari"],
    "owari": ["owarimonogatari"],
    "kizumonogatari": ["kizumonogatari"],
    "sailor moon": ["sailor moon", "bishoujo senshi sailor moon"],
    "cardcaptor": ["cardcaptor sakura"],
    "ccs": ["cardcaptor sakura"],
    "inuyasha": ["inuyasha"],
    "ranma": ["ranma 1/2"],
    "fist of north star": ["fist of the north star", "hokuto no ken"],
    "hokuto": ["fist of the north star", "hokuto no ken"],
    "berserk": ["berserk"],
    "vagabond": ["vagabond"],
    "jojo": ["jojo's bizarre adventure"],
    "jojos": ["jojo's bizarre adventure"],
    "jjba": ["jojo's bizarre adventure"],
    "dio": ["jojo's bizarre adventure"],
    "gintama": ["gintama"],
    "gin tama": ["gintama"],
    "gintoki": ["gintama"],
    "gto": ["great teacher onizuka"],
    "nhk": ["welcome to the nhk"],
    "serial experiments": ["serial experiments lain"],
    "lain": ["serial experiments lain"],
    "cowboy bebop": ["cowboy bebop"],
    "cb": ["cowboy bebop"],
    "trigun": ["trigun"],
    "outlaw star": ["outlaw star"],
    "samurai champloo": ["samurai champloo"],
    "champloo": ["samurai champloo"],
    "rurouni kenshin": ["rurouni kenshin", "samurai x"],
    "samurai x": ["rurouni kenshin", "samurai x"],
    "fullmetal": ["fullmetal alchemist"],
    "fma03": ["fullmetal alchemist 2003"],
    "promised neverland": ["the promised neverland"],
    "neverland": ["the promised neverland"],
    "aot final": ["attack on titan final season"],
    "snk final": ["attack on titan final season"],
    "86": ["86 eighty six"],
    "eighty six": ["86 eighty six"],
    "to your eternity": ["to your eternity", "fumetsu no anata e"],
    "fumetsu": ["to your eternity", "fumetsu no anata e"],
    "ranking of kings": ["ranking of kings", "ousama ranking"],
    "ousama": ["ranking of kings", "ousama ranking"],
    "summertime render": ["summertime rendering"],
    "cyberpunk": ["cyberpunk edgerunners"],
    "edgerunners": ["cyberpunk edgerunners"],
    "chainsaw": ["chainsaw man"],
    "denji": ["chainsaw man"],
    "power csm": ["chainsaw man"],
    "fire force": ["fire force", "enen no shouboutai"],
    "enen": ["fire force"],
    "black clover": ["black clover"],
    "asta": ["black clover"],
    "twin star": ["twin star exorcists"],
    "noragami": ["noragami"],
    "ao haru": ["ao haru ride", "blue spring ride"],
    "blue spring": ["ao haru ride", "blue spring ride"],
    "toradora": ["toradora"],
    "tiger dragon": ["toradora"],
    "chuunibyou": ["chuunibyou demo koi ga shitai", "love chunibyo"],
    "chunibyo": ["chuunibyou demo koi ga shitai"],
    "hyouka": ["hyouka"],
    "k-on": ["k-on"],
    "kon": ["k-on"],
    "lucky star": ["lucky star"],
    "haruhi": ["the melancholy of haruhi suzumiya", "suzumiya haruhi"],
    "suzumiya": ["the melancholy of haruhi suzumiya"],
    "clannad as": ["clannad after story"],
    "after story": ["clannad after story"],
    "anekoi": ["ane koi"],
    "madoka": ["puella magi madoka magica", "mahou shoujo madoka magica"],
    "pmmm": ["puella magi madoka magica"],
    "aku no hana": ["flowers of evil", "aku no hana"],
    "flowers of evil": ["aku no hana"],
    "ping pong": ["ping pong the animation"],
    "mushishi": ["mushishi"],
    "natsume": ["natsume's book of friends", "natsume yuujinchou"],
    "spice and wolf": ["spice and wolf", "ookami to koushinryou"],
    "ookami": ["spice and wolf"],
    "wolf and spice": ["spice and wolf"],
    "kemono jihen": ["kemono jihen"],
    "odd taxi": ["odd taxi"],
    "deaimon": ["deaimon"],
    "yuru camp": ["yuru camp", "laid-back camp"],
    "laid back camp": ["laid-back camp", "yuru camp"],
    "camping": ["yuru camp", "laid-back camp"],
    "non non biyori": ["non non biyori"],
    "flying witch": ["flying witch"],
    "barakamon": ["barakamon"],
    "silver spoon": ["silver spoon", "gin no saji"],
    "gin no saji": ["silver spoon"],
    "shirobako": ["shirobako"],
    "sakura quest": ["sakura quest"],
    "hanasaku iroha": ["hanasaku iroha"],
    "nagi asu": ["nagi no asukara", "a lull in the sea"],
    "glasslip": ["glasslip"],
    "iroduku": ["iroduku the world in colors"],
    "planetarian": ["planetarian"],
    "angel beats": ["angel beats"],
    "ab": ["angel beats"],
    "little busters": ["little busters"],
    "rewrite": ["rewrite"],
    "kanon": ["kanon"],
    "air": ["air"],
    "plastic memories": ["plastic memories"],
    "plame": ["plastic memories"],
    "erased": ["erased", "boku dake ga inai machi"],
    "bdim": ["erased", "boku dake ga inai machi"],
    "boku dake": ["erased"],
    "91 days": ["91 days"],
    "banana fish": ["banana fish"],
    "given": ["given"],
    "yuri on ice": ["yuri on ice"],
    "yoi": ["yuri on ice"],
    "free": ["free iwatobi swim club"],
    "iwatobi": ["free iwatobi swim club"],
    "kuroko": ["kuroko's basketball", "kuroko no basket"],
    "knb": ["kuroko's basketball"],
    "haikyuu": ["haikyuu"],
    "hq": ["haikyuu"],
    "volleyball": ["haikyuu"],
    "slam dunk": ["slam dunk"],
    "captain tsubasa": ["captain tsubasa"],
    "major": ["major"],
    "ace of diamond": ["diamond no ace", "ace of the diamond"],
    "daiya": ["diamond no ace"],
    "mix": ["mix meisei story"],
    "big windup": ["big windup", "ookiku furikabutte"],
    "ookiku": ["big windup"],
    "ping": ["ping pong the animation"],
    "initial d": ["initial d"],
    "overtake": ["overtake"],
    "gridman": ["ssss gridman"],
    "ssss": ["ssss gridman", "ssss dynazenon"],
    "dynazenon": ["ssss dynazenon"],
    "darling": ["darling in the franxx"],
    "ditf": ["darling in the franxx"],
    "franxx": ["darling in the franxx"],
    "promare": ["promare"],
    "kill la kill": ["kill la kill"],
    "klk": ["kill la kill"],
    "trigger": ["kill la kill", "gurren lagann"],
    "little witch": ["little witch academia"],
    "lwa": ["little witch academia"],
    "carole tuesday": ["carole & tuesday"],
    "carole": ["carole & tuesday"],
    "sk8": ["sk8 the infinity"],
    "sk8 the infinity": ["sk8 the infinity"],
    "wave": ["wave listen to me"],
    "keep your hands": ["keep your hands off eizouken"],
    "eizouken": ["keep your hands off eizouken"],
    "wonder egg": ["wonder egg priority"],
    "wep": ["wonder egg priority"],
    "vivy": ["vivy fluorite eye's song"],
    "sonny boy": ["sonny boy"],
    "odd": ["odd taxi"],
    "akudama": ["akudama drive"],
    "sk": ["sk8 the infinity"],
    "id invaded": ["id invaded"],
    "talentless nana": ["talentless nana"],
    "tbhk": ["toilet bound hanako kun"],
    "hanako": ["toilet bound hanako kun"],
    "toilet bound": ["toilet bound hanako kun"],
    "adachi": ["adachi and shimamura"],
    "yashahime": ["yashahime princess half demon"],
    "inuyashiki": ["inuyashiki"],
    "dorohedoro": ["dorohedoro"],
    "doro": ["dorohedoro"],
    "golden kamuy": ["golden kamuy"],
    "gk": ["golden kamuy"],
    "dungeon meshi": ["dungeon meshi", "delicious in dungeon"],
    "delicious dungeon": ["dungeon meshi", "delicious in dungeon"],
    "laios": ["dungeon meshi"],
    "mushoku2": ["mushoku tensei"],
    "reincarnated slime": ["that time i got reincarnated as a slime"],
    "rimuru": ["that time i got reincarnated as a slime"],
    "tensura": ["that time i got reincarnated as a slime"],
    "overlord ainz": ["overlord"],
    "konosuba explosion": ["konosuba"],
    "aqua konosuba": ["konosuba"],
    "kono": ["kono subarashii sekai ni shukufuku wo", "konosuba"],
    "tate no yuusha": ["the rising of the shield hero"],
    "rising shield": ["the rising of the shield hero"],
    "naofumi": ["the rising of the shield hero"],
    "arifureta": ["arifureta from commonplace to world's strongest"],
    "maou sama": ["the devil is a part timer", "hataraku maou sama"],
    "devil part timer": ["the devil is a part timer"],
    "hataraku": ["the devil is a part timer"],
    "cautious hero": ["cautious hero the hero is overpowered but overly cautious"],
    "seiya": ["cautious hero"],
    "isekai quartet": ["isekai quartet"],
    "smartphone": ["in another world with my smartphone"],
    "isekai smartphone": ["in another world with my smartphone"],
    "wn": ["web novel"],
    "ln": ["light novel"],
    "manga": ["manga"],
};

class SimpleCache:
    def __init__(self, ttl=300):
        self.cache = {}
        self.ttl = ttl

    def get(self, key):
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self.cache[key]
        return None

    def set(self, key, value):
        self.cache[key] = (value, time.time())

    def clear_expired(self):
        now = time.time()
        expired = [k for k, (_, t) in self.cache.items() if now - t >= self.ttl]
        for k in expired:
            del self.cache[k]

search_cache = SimpleCache(ttl=300)
themes_cache = SimpleCache(ttl=600)
animeschedule_cache = SimpleCache(ttl=1800)

def detect_search_intent(query: str) -> dict:
    """Detect if user is searching for artist, song, anime, or character."""
    q = query.lower().strip()
    intent = {"type": "general", "clean_query": query}

    # Artist patterns
    artist_patterns = ["by ", "songs by ", "music by ", "ost by ", "singer ", "artist ", "band "]
    for pat in artist_patterns:
        if q.startswith(pat):
            intent["type"] = "artist"
            intent["clean_query"] = query[len(pat):].strip()
            return intent
        if f" {pat}" in q:
            idx = q.find(f" {pat}")
            intent["type"] = "artist"
            intent["clean_query"] = query[idx + len(pat) + 1:].strip()
            return intent

    # Song/OP/ED patterns
    if any(q.startswith(p) for p in ["op ", "ed ", "opening ", "ending ", "ost ", "insert song "]):
        intent["type"] = "song"
        return intent

    # Character patterns
    char_patterns = ["character ", "voiced by ", "va ", "cv "]
    for pat in char_patterns:
        if q.startswith(pat):
            intent["type"] = "character"
            intent["clean_query"] = query[len(pat):].strip()
            return intent

    # Mood/recommendation patterns
    mood_words = ["recommend", "suggest", "similar to", "like ", "mood", "something ", "what should"]
    if any(w in q for w in mood_words):
        intent["type"] = "recommendation"
        return intent

    return intent


def expand_search_query(query: str) -> str:
    query_lower = query.lower().strip()
    if query_lower in ANIME_ALIASES:
        return ANIME_ALIASES[query_lower][0]
    for alias, expansions in ANIME_ALIASES.items():
        if query_lower.startswith(alias + " "):
            suffix = query_lower[len(alias):].strip()
            return f"{expansions[0]} {suffix}"
    return query

_cache = {}
def _cache_get(k):
    e = _cache.get(k)
    return e[0] if e and _time.time() < e[1] else None
def _cache_set(k, v, ttl=1200):
    _cache[k] = (v, _time.time() + ttl)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ── In-memory OAuth session store ─────────────────────────────────────────────
pending_oauth_sessions: dict = {}
pending_mal_sessions: dict = {}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class UserResponse(BaseModel):
    id: int
    username: str
    avatar: Optional[str] = None

class AnimeEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    mediaId: int
    status: str
    progress: int
    score: Optional[float] = None
    title_romaji: str
    title_english: Optional[str] = None
    coverImage: str
    episodes: Optional[int] = None
    nextAiringEpisode: Optional[dict] = None

class AiringScheduleItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    episode: int
    airingAt: int
    timeUntilAiring: int
    mediaId: int
    title_romaji: str
    title_english: Optional[str] = None
    coverImage: str

def create_jwt_token(user_id: int) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request) -> dict:
    # Accept token from cookie or Authorization header
    token = request.cookies.get('auth_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = verify_jwt_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({'anilist_id': user_id}, {'_id': 0})
    if not user:
        # Also try MAL users
        user = await db.users.find_one({'mal_id': user_id}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

async def make_graphql_request(query: str, access_token: str, variables: dict = None) -> dict:
    headers = {'Authorization': f'Bearer {access_token}'}
    payload = {'query': query}
    if variables:
        payload['variables'] = variables

    async with aiohttp.ClientSession() as session:
        async with session.post(ANILIST_GRAPHQL_URL, json=payload, headers=headers) as resp:
            if resp.status == 200:
                result = await resp.json()
                if 'errors' in result:
                    logger.error(f"GraphQL errors: {result['errors']}")
                    return None
                return result.get('data')
            else:
                logger.error(f"GraphQL request failed: {resp.status}")
                return None

# Auth Routes
@api_router.get("/auth/anilist/login")
async def anilist_login():
    session_id = secrets.token_urlsafe(32)
    pending_oauth_sessions[session_id] = None
    auth_url = (
        f"https://anilist.co/api/v2/oauth/authorize?"
        f"client_id={ANILIST_CLIENT_ID}&"
        f"redirect_uri={ANILIST_REDIRECT_URI}&"
        f"response_type=code&"
        f"state={session_id}"
    )
    return {"auth_url": auth_url, "session_id": session_id}

@api_router.get("/auth/anilist/redirect")
async def anilist_redirect(code: str, state: Optional[str] = None):
    async with aiohttp.ClientSession() as session:
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': ANILIST_CLIENT_ID,
            'client_secret': ANILIST_CLIENT_SECRET,
            'redirect_uri': ANILIST_REDIRECT_URI,
            'code': code
        }
        async with session.post(
            ANILIST_TOKEN_URL,
            json=token_data,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
        ) as resp:
            response_text = await resp.text()
            if resp.status != 200:
                return Response(
                    content=f"<html><body><h2>Auth failed: {response_text}</h2><p>You may close this tab.</p></body></html>",
                    media_type="text/html", status_code=400)
            import json as json_module
            token_result = json_module.loads(response_text)
            access_token = token_result.get('access_token')

    if not access_token:
        return Response(
            content="<html><body><h2>No access token received</h2><p>You may close this tab.</p></body></html>",
            media_type="text/html", status_code=400)

    query = """
    query {
        Viewer {
            id
            name
            avatar {
                large
            }
        }
    }
    """
    user_data = await make_graphql_request(query, access_token)
    if not user_data or not user_data.get('Viewer'):
        return Response(
            content="<html><body><h2>Failed to get user info</h2><p>You may close this tab.</p></body></html>",
            media_type="text/html", status_code=400)

    viewer = user_data['Viewer']

    user_doc = {
        'anilist_id': viewer['id'],
        'username': viewer['name'],
        'avatar': viewer.get('avatar', {}).get('large'),
        'access_token': access_token,
        'platform': 'anilist',
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.update_one(
        {'anilist_id': viewer['id']},
        {'$set': user_doc},
        upsert=True
    )

    jwt_token = create_jwt_token(viewer['id'])
    if state and state in pending_oauth_sessions:
        pending_oauth_sessions[state] = jwt_token
        logger.info(f"Stored JWT for session {state[:8]}… (Electron will poll for it)")
    else:
        logger.warning(f"OAuth redirect received with unknown/missing state: {state!r}")

    success_html = """<!DOCTYPE html>
<html>
<head>
  <title>AniSchedule – Login Successful</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #0f0f11; color: #e5e5e5; }
    .card { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p  { color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Login successful!</h1>
    <p>You can close this tab and return to AniSchedule.</p>
    <script>setTimeout(() => window.close(), 1500);</script>
  </div>
</body>
</html>"""
    return Response(content=success_html, media_type="text/html")

@api_router.post("/auth/anilist/callback")
async def anilist_callback(code: str, response: Response):
    async with aiohttp.ClientSession() as session:
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': ANILIST_CLIENT_ID,
            'client_secret': ANILIST_CLIENT_SECRET,
            'redirect_uri': ANILIST_REDIRECT_URI,
            'code': code
        }
        async with session.post(
            ANILIST_TOKEN_URL,
            json=token_data,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
        ) as resp:
            response_text = await resp.text()
            logger.info(f"AniList token exchange - Status: {resp.status}")
            if resp.status != 200:
                logger.error(f"AniList token exchange failed: {response_text}")
                raise HTTPException(status_code=400, detail=response_text)
            import json as json_module
            token_result = json_module.loads(response_text)
            access_token = token_result.get('access_token')

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received")

    query = """
    query {
        Viewer {
            id
            name
            avatar {
                large
            }
        }
    }
    """
    user_data = await make_graphql_request(query, access_token)
    if not user_data or not user_data.get('Viewer'):
        raise HTTPException(status_code=400, detail="Failed to get user info")

    viewer = user_data['Viewer']

    user_doc = {
        'anilist_id': viewer['id'],
        'username': viewer['name'],
        'avatar': viewer.get('avatar', {}).get('large'),
        'access_token': access_token,
        'platform': 'anilist',
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.update_one(
        {'anilist_id': viewer['id']},
        {'$set': user_doc},
        upsert=True
    )

    token = create_jwt_token(viewer['id'])
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=False,
        secure=False,
        samesite="lax",
        max_age=86400 * 30
    )
    return {
        "success": True,
        "user": {
            "id": viewer['id'],
            "username": viewer['name'],
            "avatar": viewer.get('avatar', {}).get('large')
        }
    }

@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.get("/auth/poll")
async def auth_poll(session_id: str, response: Response):
    """
    Electron renderer polls here after opening the OAuth URL in the system browser.
    Once auth completes, returns the JWT token directly in the response body so
    Electron can set it as an Authorization header (cookies are unreliable across
    the system browser / Electron boundary).

    Returns:
      {"status": "pending"}               – auth not yet complete
      {"status": "complete", "token": …}  – auth done; JWT included
      {"status": "expired"}               – session_id not found
    """
    # Check AniList sessions
    if session_id in pending_oauth_sessions:
        token = pending_oauth_sessions.get(session_id)
        if token:
            del pending_oauth_sessions[session_id]
            response.set_cookie(
                key="auth_token",
                value=token,
                httponly=False,
                secure=False,
                samesite="lax",
                max_age=86400 * 30,
                path="/"
            )
            logger.info(f"Auth poll complete for session {session_id[:8]}…")
            return {"status": "complete", "token": token}
        return {"status": "pending"}

    # Check MAL sessions
    if session_id in pending_mal_sessions:
        entry = pending_mal_sessions.get(session_id)
        if entry and entry.get("token"):
            token = entry["token"]
            del pending_mal_sessions[session_id]
            response.set_cookie(
                key="auth_token",
                value=token,
                httponly=False,
                secure=False,
                samesite="lax",
                max_age=86400 * 30,
                path="/"
            )
            logger.info(f"MAL auth poll complete for session {session_id[:8]}…")
            return {"status": "complete", "token": token}
        return {"status": "pending"}

    return {"status": "expired"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user.get('anilist_id') or user.get('mal_id'),
        "username": user['username'],
        "avatar": user.get('avatar'),
        "platform": user.get('platform', 'anilist')
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("auth_token")
    return {"success": True}

# Anime Routes
@api_router.get("/anime/list")
async def get_anime_list(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    access_token = user['access_token']

    query = """
    query ($userId: Int, $status: MediaListStatus) {
        MediaListCollection(userId: $userId, type: ANIME, status: $status) {
            lists {
                name
                status
                entries {
                    id
                    mediaId
                    status
                    progress
                    score
                    media {
                        id
                        title {
                            romaji
                            english
                        }
                        description(asHtml: false)
                        coverImage {
                            large
                        }
                        episodes
                        nextAiringEpisode {
                            id
                            episode
                            airingAt
                            timeUntilAiring
                        }
                        status
                        format
                        season
                        seasonYear
                        genres
                        tags {
                            name
                            rank
                        }
                        averageScore
                        studios(isMain: true) {
                            nodes {
                                name
                            }
                        }
                        externalLinks {
                            id
                            url
                            site
                            icon
                            color
                        }
                    }
                }
            }
        }
    }
    """
    variables = {'userId': user['anilist_id']}
    if status:
        variables['status'] = status

    data = await make_graphql_request(query, access_token, variables)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch anime list")

    entries = []
    collection = data.get('MediaListCollection', {})
    for list_group in collection.get('lists', []):
        for entry in list_group.get('entries', []):
            media = entry.get('media', {})
            studios = media.get('studios', {}).get('nodes', [])
            studio_names = [s.get('name') for s in studios if s.get('name')]
            tags = media.get('tags', [])
            tag_names = [t.get('name') for t in tags[:10] if t.get('name')]

            external_links = media.get('externalLinks', [])
            streaming_sites = ['Crunchyroll', 'Funimation', 'Netflix', 'Amazon', 'Hulu', 'Disney Plus', 'HBO Max', 'Hidive', 'VRV', 'Tubi', 'Bilibili', 'YouTube', 'iQIYI', 'WeTV']
            streaming_links = [
                {'site': link.get('site'), 'url': link.get('url'), 'icon': link.get('icon'), 'color': link.get('color')}
                for link in external_links
                if link.get('site') in streaming_sites
            ]

            entries.append({
                'id': entry['id'],
                'mediaId': entry['mediaId'],
                'status': entry['status'],
                'progress': entry['progress'],
                'score': entry.get('score'),
                'title_romaji': media.get('title', {}).get('romaji', ''),
                'title_english': media.get('title', {}).get('english'),
                'description': media.get('description', ''),
                'coverImage': media.get('coverImage', {}).get('large', ''),
                'episodes': media.get('episodes'),
                'nextAiringEpisode': media.get('nextAiringEpisode'),
                'mediaStatus': media.get('status'),
                'format': media.get('format'),
                'season': media.get('season'),
                'seasonYear': media.get('seasonYear'),
                'genres': media.get('genres', []),
                'tags': tag_names,
                'averageScore': media.get('averageScore'),
                'studios': studio_names,
                'streamingLinks': streaming_links
            })

    return {"entries": entries, "count": len(entries)}

@api_router.get("/anime/schedule")
async def get_airing_schedule(request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    watching_query = """
    query ($userId: Int) {
        MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
            lists {
                entries {
                    mediaId
                    media {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            large
                        }
                        nextAiringEpisode {
                            id
                            episode
                            airingAt
                            timeUntilAiring
                        }
                        airingSchedule(notYetAired: true, perPage: 10) {
                            nodes {
                                id
                                episode
                                airingAt
                                timeUntilAiring
                            }
                        }
                    }
                }
            }
        }
    }
    """

    data = await make_graphql_request(watching_query, access_token, {'userId': user['anilist_id']})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch schedule")

    schedules = []
    collection = data.get('MediaListCollection', {})
    for list_group in collection.get('lists', []):
        for entry in list_group.get('entries', []):
            media = entry.get('media', {})
            airing_schedule = media.get('airingSchedule', {}).get('nodes', [])

            for schedule in airing_schedule:
                schedules.append({
                    'id': schedule['id'],
                    'episode': schedule['episode'],
                    'airingAt': schedule['airingAt'],
                    'timeUntilAiring': schedule['timeUntilAiring'],
                    'mediaId': media['id'],
                    'title_romaji': media.get('title', {}).get('romaji', ''),
                    'title_english': media.get('title', {}).get('english'),
                    'coverImage': media.get('coverImage', {}).get('large', '')
                })

    schedules.sort(key=lambda x: x['airingAt'])
    return {"schedules": schedules, "count": len(schedules)}


def build_ics(events):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AniSchedule//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AniSchedule",
        "X-WR-TIMEZONE:UTC",
    ]
    for e in events:
        start = e["start"]
        end = e["end"]
        fmt = "%Y%m%dT%H%M%SZ"
        lines += [
            "BEGIN:VEVENT",
            f"UID:{e['uid']}",
            f"DTSTAMP:{start.strftime(fmt)}",
            f"DTSTART:{start.strftime(fmt)}",
            f"DTEND:{end.strftime(fmt)}",
            f"SUMMARY:{e['summary']}",
            f"DESCRIPTION:{e.get('description', '')}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)

@api_router.get("/calendar/export/ics")
async def export_ics(request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    query = """
    query ($userId: Int) {
        MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
            lists {
                entries {
                    media {
                        id
                        title {
                            romaji
                            english
                        }
                        airingSchedule(notYetAired: true, perPage: 25) {
                            nodes {
                                episode
                                airingAt
                            }
                        }
                    }
                }
            }
        }
    }
    """

    data = await make_graphql_request(query, access_token, {'userId': user['anilist_id']})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch schedule")

    events = []
    collection = data.get('MediaListCollection', {})
    for list_group in collection.get('lists', []):
        for entry in list_group.get('entries', []):
            media = entry.get('media', {})
            title = media.get('title', {}).get('english') or media.get('title', {}).get('romaji', 'Unknown')
            airing_schedule = media.get('airingSchedule', {}).get('nodes', [])
            for schedule in airing_schedule:
                start = datetime.fromtimestamp(schedule['airingAt'], tz=timezone.utc)
                events.append({
                    "summary": f"{title} - Episode {schedule['episode']}",
                    "start": start,
                    "end": start + timedelta(minutes=24),
                    "description": f"Episode {schedule['episode']} of {title} airs!",
                    "uid": f"anischedule-{media['id']}-{schedule['episode']}",
                })
    ics_content = build_ics(events)
    return StreamingResponse(
        io.BytesIO(ics_content.encode('utf-8')),
        media_type='text/calendar',
        headers={'Content-Disposition': 'attachment; filename="anischedule.ics"'}
    )

class AnimeEntryUpdate(BaseModel):
    progress: Optional[int] = None
    score: Optional[float] = None
    notes: Optional[str] = None
    startedAt: Optional[dict] = None
    completedAt: Optional[dict] = None

@api_router.put("/anime/entry/{entry_id}")
async def update_anime_entry(entry_id: int, update: AnimeEntryUpdate, request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    mutation = """
    mutation ($id: Int, $progress: Int, $score: Float, $notes: String, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
        SaveMediaListEntry(id: $id, progress: $progress, score: $score, notes: $notes, startedAt: $startedAt, completedAt: $completedAt) {
            id
            progress
            score
            notes
            startedAt { year month day }
            completedAt { year month day }
        }
    }
    """

    variables = {'id': entry_id}
    if update.progress is not None:
        variables['progress'] = update.progress
    if update.score is not None:
        variables['score'] = update.score
    if update.notes is not None:
        variables['notes'] = update.notes
    if update.startedAt is not None:
        variables['startedAt'] = update.startedAt
    if update.completedAt is not None:
        variables['completedAt'] = update.completedAt

    data = await make_graphql_request(mutation, access_token, variables)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to update entry")

    return {"success": True, "entry": data.get('SaveMediaListEntry')}

@api_router.get("/anime/entry/{entry_id}")
async def get_anime_entry(entry_id: int, request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    query = """
    query ($id: Int) {
        MediaList(id: $id) {
            id
            mediaId
            status
            progress
            score
            notes
            startedAt { year month day }
            completedAt { year month day }
            media {
                id
                title { romaji english }
                episodes
                coverImage { large }
            }
        }
    }
    """

    data = await make_graphql_request(query, access_token, {'id': entry_id})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch entry")

    return data.get('MediaList')

@api_router.get("/")
async def root():
    return {"message": "AniSchedule API"}

@api_router.get("/anime/search")
async def search_anime(
    request: Request,
    query: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[int] = None,
    season: Optional[str] = None,
    format: Optional[str] = None,
    status: Optional[str] = None,
    sort: Optional[str] = "POPULARITY_DESC",
    page: int = 1,
    perPage: int = 20
):
    user = await get_current_user(request)
    access_token = user['access_token']

    search_query = """
    query ($page: Int, $perPage: Int, $search: String, $genre: String, $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
            pageInfo { total currentPage lastPage hasNextPage }
            media(search: $search, genre: $genre, seasonYear: $year, season: $season, format: $format, status: $status, sort: $sort, type: ANIME) {
                id
                title { romaji english }
                description(asHtml: false)
                coverImage { large }
                bannerImage
                episodes
                status
                format
                season
                seasonYear
                genres
                tags { name rank }
                averageScore
                popularity
                studios(isMain: true) { nodes { name } }
                nextAiringEpisode { episode airingAt timeUntilAiring }
                externalLinks { id url site icon color }
            }
        }
    }
    """

    variables = {'page': page, 'perPage': perPage, 'sort': [sort]}

    if query:
        expanded_query = expand_search_query(query)
        variables['search'] = expanded_query
    if genre:
        variables['genre'] = genre
    if year:
        variables['year'] = year
    if season:
        variables['season'] = season
    if format:
        variables['format'] = format
    if status:
        variables['status'] = status

    data = await make_graphql_request(search_query, access_token, variables)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to search anime")

    page_data = data.get('Page', {})
    media_list = page_data.get('media', [])

    results = []
    for media in media_list:
        studios = media.get('studios', {}).get('nodes', [])
        studio_names = [s.get('name') for s in studios if s.get('name')]
        tags = media.get('tags', [])
        tag_names = [t.get('name') for t in tags[:10] if t.get('name')]

        external_links = media.get('externalLinks', [])
        streaming_sites = ['Crunchyroll', 'Funimation', 'Netflix', 'Amazon', 'Hulu', 'Disney Plus', 'HBO Max', 'Hidive', 'VRV', 'Tubi', 'Bilibili', 'YouTube', 'iQIYI', 'WeTV']
        streaming_links = [
            {'site': link.get('site'), 'url': link.get('url'), 'icon': link.get('icon'), 'color': link.get('color')}
            for link in external_links
            if link.get('site') in streaming_sites
        ]

        results.append({
            'mediaId': media['id'],
            'title_romaji': media.get('title', {}).get('romaji', ''),
            'title_english': media.get('title', {}).get('english'),
            'description': media.get('description', ''),
            'coverImage': media.get('coverImage', {}).get('large', ''),
            'bannerImage': media.get('bannerImage'),
            'episodes': media.get('episodes'),
            'mediaStatus': media.get('status'),
            'format': media.get('format'),
            'season': media.get('season'),
            'seasonYear': media.get('seasonYear'),
            'genres': media.get('genres', []),
            'tags': tag_names,
            'averageScore': media.get('averageScore'),
            'popularity': media.get('popularity'),
            'studios': studio_names,
            'nextAiringEpisode': media.get('nextAiringEpisode'),
            'streamingLinks': streaming_links
        })

    response = {"results": results, "pageInfo": page_data.get('pageInfo', {})}

    if query:
        expanded = expand_search_query(query)
        if expanded != query:
            response["expanded_query"] = expanded

    return response

@api_router.get("/anime/details/{media_id}")
async def get_anime_details(media_id: int, request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    query = """
    query ($id: Int) {
        Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            description(asHtml: false)
            coverImage { large extraLarge }
            bannerImage
            episodes
            duration
            status
            format
            season
            seasonYear
            startDate { year month day }
            endDate { year month day }
            genres
            tags { name rank }
            averageScore
            meanScore
            popularity
            trending
            favourites
            studios(isMain: true) { nodes { name } }
            source
            hashtag
            synonyms
            nextAiringEpisode { episode airingAt timeUntilAiring }
            externalLinks { url site icon color }
            characters(sort: [ROLE, FAVOURITES_DESC], perPage: 12) {
                edges {
                    node { name { full } image { medium } }
                    role
                    voiceActors(language: JAPANESE) { name { full } }
                }
            }
            staff(sort: [RELEVANCE], perPage: 8) {
                edges {
                    node { name { full } image { medium } }
                    role
                }
            }
        }
    }
    """

    data = await make_graphql_request(query, access_token, {'id': media_id})
    if not data or not data.get('Media'):
        raise HTTPException(status_code=404, detail="Anime not found")

    media = data['Media']
    studios = media.get('studios', {}).get('nodes', [])
    studio_names = [s.get('name') for s in studios if s.get('name')]
    tags = media.get('tags', [])
    tag_names = [t.get('name') for t in tags[:15] if t.get('name')]

    external_links = media.get('externalLinks', [])
    streaming_sites = ['Crunchyroll', 'Funimation', 'Netflix', 'Amazon', 'Hulu', 'Disney Plus', 'HBO Max', 'Hidive', 'VRV', 'Tubi', 'Bilibili', 'YouTube', 'iQIYI', 'WeTV']
    streaming_links = [
        {'site': link.get('site'), 'url': link.get('url'), 'icon': link.get('icon'), 'color': link.get('color')}
        for link in external_links
        if link.get('site') in streaming_sites
    ]

    characters = []
    for edge in media.get('characters', {}).get('edges', []):
        node = edge.get('node', {})
        voice_actors = edge.get('voiceActors', [])
        va_name = voice_actors[0].get('name', {}).get('full') if voice_actors else None
        characters.append({
            'name': node.get('name', {}).get('full'),
            'image': node.get('image', {}).get('medium'),
            'role': edge.get('role'),
            'voiceActor': va_name
        })

    staff = []
    for edge in media.get('staff', {}).get('edges', []):
        node = edge.get('node', {})
        staff.append({
            'name': node.get('name', {}).get('full'),
            'image': node.get('image', {}).get('medium'),
            'role': edge.get('role')
        })

    return {
        'mediaId': media['id'],
        'title_romaji': media.get('title', {}).get('romaji', ''),
        'title_english': media.get('title', {}).get('english'),
        'title_native': media.get('title', {}).get('native'),
        'description': media.get('description', ''),
        'coverImage': media.get('coverImage', {}).get('large', ''),
        'bannerImage': media.get('bannerImage'),
        'episodes': media.get('episodes'),
        'duration': media.get('duration'),
        'mediaStatus': media.get('status'),
        'format': media.get('format'),
        'season': media.get('season'),
        'seasonYear': media.get('seasonYear'),
        'startDate': media.get('startDate'),
        'endDate': media.get('endDate'),
        'genres': media.get('genres', []),
        'tags': tag_names,
        'averageScore': media.get('averageScore'),
        'meanScore': media.get('meanScore'),
        'popularity': media.get('popularity'),
        'trending': media.get('trending'),
        'favourites': media.get('favourites'),
        'studios': studio_names,
        'source': media.get('source'),
        'synonyms': media.get('synonyms', []),
        'nextAiringEpisode': media.get('nextAiringEpisode'),
        'streamingLinks': streaming_links,
        'characters': characters,
        'staff': staff
    }

@api_router.post("/anime/entry/{entry_id}/increment")
async def increment_anime_progress(entry_id: int, request: Request):
    user = await get_current_user(request)
    access_token = user['access_token']

    get_query = """
    query ($id: Int) {
        MediaList(id: $id) {
            id
            progress
            media { episodes }
        }
    }
    """

    data = await make_graphql_request(get_query, access_token, {'id': entry_id})
    if not data or not data.get('MediaList'):
        raise HTTPException(status_code=404, detail="Entry not found")

    current_progress = data['MediaList'].get('progress', 0)
    max_episodes = data['MediaList'].get('media', {}).get('episodes') or 9999
    new_progress = min(current_progress + 1, max_episodes)

    mutation = """
    mutation ($id: Int, $progress: Int) {
        SaveMediaListEntry(id: $id, progress: $progress) {
            id
            progress
        }
    }
    """

    result = await make_graphql_request(mutation, access_token, {'id': entry_id, 'progress': new_progress})
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update progress")

    return {"success": True, "progress": new_progress, "entry": result.get('SaveMediaListEntry')}

def generate_calendar_token(user_id: int) -> str:
    token_data = f"{user_id}-{JWT_SECRET}"
    return hashlib.sha256(token_data.encode()).hexdigest()[:32]

@api_router.get("/calendar/subscribe/token")
async def get_calendar_subscribe_token(request: Request):
    user = await get_current_user(request)
    user_id = user['anilist_id']

    token = generate_calendar_token(user_id)

    await db.calendar_tokens.update_one(
        {'user_id': user_id},
        {'$set': {'token': token, 'user_id': user_id, 'updated_at': datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    base_url = 'http://localhost:18472'
    subscribe_url = f"{base_url}/api/calendar/subscribe/{token}"
    webcal_url = subscribe_url.replace('https://', 'webcal://').replace('http://', 'webcal://')

    return {
        "token": token,
        "subscribe_url": subscribe_url,
        "webcal_url": webcal_url,
        "google_url": f"https://calendar.google.com/calendar/render?cid={subscribe_url}",
        "outlook_url": f"https://outlook.live.com/calendar/0/addfromweb?url={subscribe_url}"
    }

@api_router.get("/calendar/subscribe/{token}")
async def get_subscribable_calendar(token: str):
    token_doc = await db.calendar_tokens.find_one({'token': token}, {'_id': 0})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid calendar token")

    user_id = token_doc['user_id']
    user = await db.users.find_one({'anilist_id': user_id}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user['access_token']

    query = """
    query ($userId: Int) {
        MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
            lists {
                entries {
                    media {
                        id
                        title { romaji english }
                        airingSchedule(notYetAired: true, perPage: 50) {
                            nodes { episode airingAt }
                        }
                    }
                }
            }
        }
    }
    """

    data = await make_graphql_request(query, access_token, {'userId': user_id})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch schedule")

    events = []
    collection = data.get('MediaListCollection', {})
    for list_group in collection.get('lists', []):
        for entry in list_group.get('entries', []):
            media = entry.get('media', {})
            title = media.get('title', {}).get('english') or media.get('title', {}).get('romaji', 'Unknown')
            airing_schedule = media.get('airingSchedule', {}).get('nodes', [])
            for schedule in airing_schedule:
                start = datetime.fromtimestamp(schedule['airingAt'], tz=timezone.utc)
                events.append({
                    "summary": f"{title} - Episode {schedule['episode']}",
                    "start": start,
                    "end": start + timedelta(minutes=24),
                    "description": f"Episode {schedule['episode']} of {title} airs!",
                    "uid": f"anischedule-{media['id']}-{schedule['episode']}",
                })
    ics_content = build_ics(events)
    return Response(
        content=ics_content,
        media_type='text/calendar',
        headers={
            'Content-Disposition': 'inline; filename="anischedule.ics"',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    )

# MAL OAuth Routes
@api_router.get("/auth/mal/login")
async def mal_login():
    if not MAL_CLIENT_ID:
        raise HTTPException(status_code=500, detail="MAL not configured")

    code_verifier = secrets.token_urlsafe(64)[:128]
    session_id = secrets.token_urlsafe(32)

    pending_mal_sessions[session_id] = {"code_verifier": code_verifier, "token": None}

    from urllib.parse import quote
    encoded_redirect = quote(MAL_REDIRECT_URI, safe='')

    auth_url = (
        f"https://myanimelist.net/v1/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={MAL_CLIENT_ID}&"
        f"redirect_uri={encoded_redirect}&"
        f"code_challenge={code_verifier}&"
        f"code_challenge_method=plain&"
        f"state={session_id}"
    )

    return {"auth_url": auth_url, "session_id": session_id}

@api_router.get("/auth/mal/redirect")
async def mal_redirect(code: str, state: Optional[str] = None):
    if not MAL_CLIENT_ID or not MAL_CLIENT_SECRET:
        return Response(content="<html><body><h2>MAL not configured</h2></body></html>",
                        media_type="text/html", status_code=500)

    if not state or state not in pending_mal_sessions:
        return Response(
            content="<html><body><h2>Invalid or expired session</h2><p>Please try logging in again.</p></body></html>",
            media_type="text/html", status_code=400)

    code_verifier = pending_mal_sessions[state]["code_verifier"]

    form_data = {
        'client_id': MAL_CLIENT_ID,
        'client_secret': MAL_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': MAL_REDIRECT_URI,
        'code_verifier': code_verifier
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}

    async with aiohttp.ClientSession() as session:
        async with session.post(MAL_TOKEN_URL, data=form_data, headers=headers) as resp:
            resp_text = await resp.text()
            if resp.status != 200:
                logger.error(f"MAL token exchange failed: {resp_text}")
                return Response(
                    content=f"<html><body><h2>MAL auth failed</h2><p>{resp_text}</p></body></html>",
                    media_type="text/html", status_code=400)
            import json as _json
            token_result = _json.loads(resp_text)
            access_token = token_result.get('access_token')

    if not access_token:
        return Response(content="<html><body><h2>No access token received</h2></body></html>",
                        media_type="text/html", status_code=400)

    async with aiohttp.ClientSession() as session:
        async with session.get(f"{MAL_API_URL}/users/@me",
                               headers={'Authorization': f'Bearer {access_token}'}) as resp:
            if resp.status != 200:
                return Response(content="<html><body><h2>Failed to get MAL user info</h2></body></html>",
                                media_type="text/html", status_code=400)
            user_data = await resp.json()

    user_doc = {
        'mal_id': user_data['id'],
        'username': user_data['name'],
        'avatar': user_data.get('picture'),
        'mal_access_token': access_token,
        'platform': 'mal',
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.update_one({'mal_id': user_data['id']}, {'$set': user_doc}, upsert=True)

    jwt_token = create_jwt_token(user_data['id'])
    pending_mal_sessions[state]["token"] = jwt_token
    logger.info(f"MAL JWT stored for session {state[:8]}…")

    success_html = """<!DOCTYPE html>
<html>
<head>
  <title>AniSchedule – MAL Login Successful</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #0f0f11; color: #e5e5e5; }
    .card { text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ MAL Login successful!</h1>
    <p>You can close this tab and return to AniSchedule.</p>
    <script>setTimeout(() => window.close(), 1500);</script>
  </div>
</body>
</html>"""
    return Response(content=success_html, media_type="text/html")

@api_router.post("/auth/mal/callback")
async def mal_callback(code: str, code_verifier: str, response: Response):
    if not MAL_CLIENT_ID or not MAL_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="MAL not configured")

    form_data = {
        'client_id': MAL_CLIENT_ID,
        'client_secret': MAL_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': MAL_REDIRECT_URI,
        'code_verifier': code_verifier
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(MAL_TOKEN_URL, data=form_data,
                                headers={'Content-Type': 'application/x-www-form-urlencoded'}) as resp:
            error_text = await resp.text()
            if resp.status != 200:
                raise HTTPException(status_code=400, detail=f"MAL auth failed: {error_text}")
            try:
                token_result = await resp.json()
            except:
                import json
                token_result = json.loads(error_text)
            access_token = token_result.get('access_token')

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received")

    async with aiohttp.ClientSession() as session:
        async with session.get(f"{MAL_API_URL}/users/@me",
                               headers={'Authorization': f'Bearer {access_token}'}) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=400, detail="Failed to get MAL user info")
            user_data = await resp.json()

    user_doc = {
        'mal_id': user_data['id'],
        'username': user_data['name'],
        'avatar': user_data.get('picture'),
        'mal_access_token': access_token,
        'platform': 'mal',
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.update_one({'mal_id': user_data['id']}, {'$set': user_doc}, upsert=True)

    token = create_jwt_token(user_data['id'])
    response.set_cookie(key="auth_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=86400 * 30)

    return {
        "success": True,
        "user": {
            "id": user_data['id'],
            "username": user_data['name'],
            "avatar": user_data.get('picture'),
            "platform": "mal"
        }
    }

def parse_theme(theme_str, anime_info=None):
    import re
    match = re.match(r'(\d+):\s*"([^"]+)"\s*by\s*([^(]+)(?:\s*\(([^)]+)\))?', theme_str)
    if match:
        result = {
            'number': int(match.group(1)),
            'title': match.group(2).strip(),
            'artist': match.group(3).strip(),
            'episodes': match.group(4).strip() if match.group(4) else None,
            'raw': theme_str
        }
    else:
        match2 = re.match(r'"([^"]+)"\s*by\s*([^(]+)(?:\s*\(([^)]+)\))?', theme_str)
        if match2:
            result = {
                'title': match2.group(1).strip(),
                'artist': match2.group(2).strip(),
                'episodes': match2.group(3).strip() if match2.group(3) else None,
                'raw': theme_str
            }
        else:
            result = {'raw': theme_str}

    if anime_info:
        result['anime'] = anime_info

    return result

@api_router.get("/anime/songs/search")
async def search_anime_songs(q: str, page: int = 1, sfw: bool = True, type: str = None):
    expanded_q = expand_search_query(q)

    cache_key = f"search:{expanded_q}:{page}:{sfw}:{type}"
    cached = search_cache.get(cache_key)
    if cached:
        return cached

    async with aiohttp.ClientSession() as session:
        url = f"{JIKAN_API}/anime?q={expanded_q}&page={page}&limit=10"
        if sfw:
            url += "&sfw=true"
        async with session.get(url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=500, detail="Search failed")
            data = await resp.json()

    anime_list = data.get('data', [])
    songs = []

    async with aiohttp.ClientSession() as session:
        for anime in anime_list[:6]:
            mal_id = anime.get('mal_id')

            theme_cache_key = f"themes:{mal_id}"
            cached_themes = themes_cache.get(theme_cache_key)

            if cached_themes:
                themes_data = cached_themes
            else:
                try:
                    await asyncio.sleep(0.3)
                    async with session.get(f"{JIKAN_API}/anime/{mal_id}/themes") as resp:
                        if resp.status == 200:
                            theme_resp = await resp.json()
                            themes_data = theme_resp.get('data', {})
                            themes_cache.set(theme_cache_key, themes_data)
                        else:
                            themes_data = {}
                except:
                    themes_data = {}

            anime_info = {
                'mal_id': mal_id,
                'title': anime.get('title'),
                'title_english': anime.get('title_english'),
                'image': anime.get('images', {}).get('jpg', {}).get('image_url'),
                'year': anime.get('year'),
                'type': anime.get('type'),
                'score': anime.get('score')
            }

            for op in themes_data.get('openings', []):
                song = parse_theme(op, anime_info)
                song['song_type'] = 'OP'
                if not type or type.lower() in ['op', 'opening']:
                    songs.append(song)

            for ed in themes_data.get('endings', []):
                song = parse_theme(ed, anime_info)
                song['song_type'] = 'ED'
                if not type or type.lower() in ['ed', 'ending']:
                    songs.append(song)

    q_lower = q.lower()
    expanded_lower = expanded_q.lower()
    filtered_songs = [
        s for s in songs
        if q_lower in s.get('title', '').lower()
        or q_lower in s.get('artist', '').lower()
        or q_lower in s.get('anime', {}).get('title', '').lower()
        or q_lower in (s.get('anime', {}).get('title_english') or '').lower()
        or expanded_lower in s.get('anime', {}).get('title', '').lower()
        or expanded_lower in (s.get('anime', {}).get('title_english') or '').lower()
    ]

    result = {
        'songs': filtered_songs if filtered_songs else songs[:20],
        'anime_results': [{
            'mal_id': a.get('mal_id'),
            'title': a.get('title'),
            'title_english': a.get('title_english'),
            'image': a.get('images', {}).get('jpg', {}).get('image_url'),
            'year': a.get('year'),
            'type': a.get('type'),
            'score': a.get('score')
        } for a in anime_list],
        'pagination': data.get('pagination', {}),
        'query': q,
        'expanded_query': expanded_q if expanded_q != q else None
    }

    search_cache.set(cache_key, result)
    return result

@api_router.get("/anime/songs/recent")
async def get_recent_anime_songs(page: int = 1, sfw: bool = True):
    cache_key = f"recent:{page}:{sfw}"
    cached = search_cache.get(cache_key)
    if cached:
        return cached

    async with aiohttp.ClientSession() as session:
        url = f"{JIKAN_API}/seasons/now?page={page}&limit=24"
        if sfw:
            url += "&sfw=true"
        async with session.get(url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch seasonal anime")
            data = await resp.json()

    results = []
    for anime in data.get('data', []):
        results.append({
            'mal_id': anime.get('mal_id'),
            'title': anime.get('title'),
            'title_english': anime.get('title_english'),
            'image': anime.get('images', {}).get('jpg', {}).get('large_image_url') or anime.get('images', {}).get('jpg', {}).get('image_url'),
            'year': anime.get('year'),
            'season': anime.get('season'),
            'type': anime.get('type'),
            'score': anime.get('score'),
            'genres': [g.get('name') for g in anime.get('genres', [])],
            'studios': [s.get('name') for s in anime.get('studios', [])]
        })

    result = {'results': results, 'pagination': data.get('pagination', {})}
    search_cache.set(cache_key, result)
    return result

@api_router.get("/anime/songs/{anime_id}")
async def get_anime_songs(anime_id: int):
    cache_key = f"themes:{anime_id}"
    cached = themes_cache.get(cache_key)

    if not cached:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{JIKAN_API}/anime/{anime_id}/themes") as resp:
                if resp.status == 404:
                    raise HTTPException(status_code=404, detail="Anime not found")
                if resp.status != 200:
                    raise HTTPException(status_code=500, detail="Failed to fetch anime themes")
                data = await resp.json()

        themes_data = data.get('data', {})
        themes_cache.set(cache_key, themes_data)
    else:
        themes_data = cached

    return {
        'anime_id': anime_id,
        'openings': [parse_theme(op) for op in themes_data.get('openings', [])],
        'endings': [parse_theme(ed) for ed in themes_data.get('endings', [])]
    }

@api_router.get("/schedule/animeschedule")
async def get_animeschedule(request: Request):
    cache_key = "animeschedule:all"
    cached = animeschedule_cache.get(cache_key)
    if cached:
        return cached

    async with aiohttp.ClientSession() as session:
        headers = {'Accept': 'application/json', 'User-Agent': 'AniSchedule/1.0'}
        try:
            async with session.get(f"{ANIMESCHEDULE_API}/timetables/sub", headers=headers) as resp:
                sub_data = await resp.json() if resp.status == 200 else []
        except:
            sub_data = []

        try:
            async with session.get(f"{ANIMESCHEDULE_API}/timetables/dub", headers=headers) as resp:
                dub_data = await resp.json() if resp.status == 200 else []
        except:
            dub_data = []

    schedules = {}

    for anime in (sub_data if isinstance(sub_data, list) else []):
        route = anime.get('route', '')
        if route not in schedules:
            schedules[route] = {
                'title': anime.get('title'),
                'route': route,
                'imageUrl': f"https://img.animeschedule.net/production/assets/public/img/{anime.get('imageVersionRoute')}" if anime.get('imageVersionRoute') else None,
                'mal_id': anime.get('malId'),
                'anilist_id': anime.get('anilistId'),
                'sub': None,
                'dub': None,
            }
        schedules[route]['sub'] = {
            'episode': anime.get('episodeNumber'),
            'releaseDate': anime.get('episodeDate'),
            'delayedUntil': anime.get('delayedUntil'),
        }

    for anime in (dub_data if isinstance(dub_data, list) else []):
        route = anime.get('route', '')
        if route not in schedules:
            schedules[route] = {
                'title': anime.get('title'),
                'route': route,
                'imageUrl': f"https://img.animeschedule.net/production/assets/public/img/{anime.get('imageVersionRoute')}" if anime.get('imageVersionRoute') else None,
                'mal_id': anime.get('malId'),
                'anilist_id': anime.get('anilistId'),
                'sub': None,
                'dub': None,
            }
        schedules[route]['dub'] = {
            'episode': anime.get('episodeNumber'),
            'releaseDate': anime.get('episodeDate'),
            'delayedUntil': anime.get('delayedUntil'),
        }

    result = {'schedules': list(schedules.values()), 'count': len(schedules)}
    animeschedule_cache.set(cache_key, result)
    return result

@api_router.get("/schedule/animeschedule/search")
async def search_animeschedule(title: str):
    all_schedules = animeschedule_cache.get("animeschedule:all")
    if all_schedules:
        title_lower = title.lower()
        matches = [s for s in all_schedules.get('schedules', []) if title_lower in s.get('title', '').lower()]
        if matches:
            return {'results': matches}

    async with aiohttp.ClientSession() as session:
        headers = {'Accept': 'application/json', 'User-Agent': 'AniSchedule/1.0'}
        try:
            async with session.get(f"{ANIMESCHEDULE_API}/anime", params={'q': title}, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    results = []
                    for anime in (data if isinstance(data, list) else data.get('anime', [])):
                        results.append({
                            'title': anime.get('title'),
                            'route': anime.get('route'),
                            'mal_id': anime.get('malId'),
                            'anilist_id': anime.get('anilistId'),
                            'imageUrl': f"https://img.animeschedule.net/production/assets/public/img/{anime.get('imageVersionRoute')}" if anime.get('imageVersionRoute') else None,
                        })
                    return {'results': results}
        except Exception as e:
            logger.error(f"AnimSchedule search error: {e}")

    return {'results': []}

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

class NotificationSettings(BaseModel):
    reminderTimes: List[str] = ["30"]
    releaseTypes: List[str] = ["sub"]
    adultContent: bool = False

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, request: Request):
    user = await get_current_user(request)
    user_id = user.get('anilist_id') or user.get('mal_id')

    await db.push_subscriptions.update_one(
        {'user_id': user_id},
        {'$set': {
            'user_id': user_id,
            'endpoint': subscription.endpoint,
            'keys': subscription.keys,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    return {"success": True, "message": "Push subscription saved"}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(request: Request):
    user = await get_current_user(request)
    user_id = user.get('anilist_id') or user.get('mal_id')
    await db.push_subscriptions.delete_one({'user_id': user_id})
    return {"success": True, "message": "Push subscription removed"}

@api_router.post("/push/settings")
async def save_notification_settings(settings: NotificationSettings, request: Request):
    user = await get_current_user(request)
    user_id = user.get('anilist_id') or user.get('mal_id')

    await db.notification_settings.update_one(
        {'user_id': user_id},
        {'$set': {
            'user_id': user_id,
            'reminderTimes': settings.reminderTimes,
            'releaseTypes': settings.releaseTypes,
            'adultContent': settings.adultContent,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    return {"success": True}

@api_router.get("/push/settings")
async def get_notification_settings(request: Request):
    user = await get_current_user(request)
    user_id = user.get('anilist_id') or user.get('mal_id')

    settings = await db.notification_settings.find_one({'user_id': user_id}, {'_id': 0})

    if settings:
        return {
            'reminderTimes': settings.get('reminderTimes', ['30']),
            'releaseTypes': settings.get('releaseTypes', ['sub']),
            'adultContent': settings.get('adultContent', False)
        }

    return {'reminderTimes': ['30'], 'releaseTypes': ['sub'], 'adultContent': False}

@api_router.post("/push/test")
async def send_test_notification(request: Request):
    user = await get_current_user(request)
    user_id = user.get('anilist_id') or user.get('mal_id')

    subscription = await db.push_subscriptions.find_one({'user_id': user_id}, {'_id': 0})
    if not subscription:
        raise HTTPException(status_code=404, detail="No push subscription found")

    try:
        webpush(
            subscription_info={"endpoint": subscription['endpoint'], "keys": subscription['keys']},
            data=json.dumps({
                "title": "AniSchedule Test",
                "body": "Push notifications are working! 🎉",
                "icon": "/favicon.svg",
                "tag": "test"
            }),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return {"success": True, "message": "Test notification sent"}
    except WebPushException as e:
        logger.error(f"Push notification error: {e}")
        if e.response and e.response.status_code in [404, 410]:
            await db.push_subscriptions.delete_one({'user_id': user_id})
            raise HTTPException(status_code=410, detail="Push subscription expired, please re-subscribe")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")

@api_router.get("/aliases")
async def get_anime_aliases():
    return {"aliases": ANIME_ALIASES}

# CORS
_cors_origins_env = os.environ.get('CORS_ORIGINS', '')
_cors_origins = (
    _cors_origins_env.split(',')
    if _cors_origins_env
    else [
        "null",
        "http://localhost:3000",
        "http://localhost:18472",
        "http://127.0.0.1:18472",
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()



# ── AI Chat ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        uid = str(current_user.get("id") or current_user.get("username", ""))
        cached = _cache_get(f"ctx_{uid}")
        if cached:
            anime_list, schedules = cached
        else:
            try:
                anime_list = await db.anime_entries.find({"user_id": uid}).to_list(length=1000)
                schedules  = await db.schedules.find({"user_id": uid}).to_list(length=200)
            except Exception:
                anime_list, schedules = [], []
            _cache_set(f"ctx_{uid}", (anime_list, schedules))
        user_context = build_user_context(
            anime_list=anime_list,
            schedules=schedules,
            username=current_user.get("username", ""),
        )
        reply = await ai_chat(req.messages, user_context)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
