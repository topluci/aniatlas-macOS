"""
Recommendation Engine — builds rich user context for AI.
Strictly excludes completed and watching anime from recommendations.
"""
from datetime import datetime, timezone, timedelta
from collections import Counter
from typing import List, Dict


def build_user_context(anime_list: List[Dict], schedules: List[Dict], username: str = "") -> Dict:
    watching   = [a for a in anime_list if a.get("status") == "CURRENT"]
    completed  = [a for a in anime_list if a.get("status") == "COMPLETED"]
    planning   = [a for a in anime_list if a.get("status") == "PLANNING"]
    paused     = [a for a in anime_list if a.get("status") == "PAUSED"]
    dropped    = [a for a in anime_list if a.get("status") == "DROPPED"]

    # Collect IDs to exclude from recommendations
    exclude_ids = set()
    for a in watching + completed + dropped:
        aid = a.get("mediaId") or a.get("id")
        if aid:
            exclude_ids.add(str(aid))
        # Also exclude by title to be safe
        t = _title(a)
        if t:
            exclude_ids.add(t.lower().strip())

    # Genre preferences from completed + watching
    genre_counter: Counter = Counter()
    scores = []
    for a in completed + watching:
        for g in (a.get("genres") or []):
            genre_counter[g] += 1
        s = a.get("score") or a.get("userScore") or 0
        if s and s > 0:
            scores.append(s / 10 if s > 10 else s)

    avg_score = sum(scores) / len(scores) if scores else 0

    # Top rated by user score
    scored = [a for a in completed if (a.get("score") or 0) > 0]
    top_rated = sorted(scored, key=lambda x: x.get("score", 0), reverse=True)[:10]

    # Schedule breakdown
    now = datetime.now(timezone.utc)
    today_s = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    today_e = now.replace(hour=23, minute=59, second=59).timestamp()
    tomorrow_s = (now.replace(hour=0, minute=0, second=0) + timedelta(days=1)).timestamp()
    tomorrow_e = tomorrow_s + 86399
    week_e = today_s + 7 * 86400

    def fmt(s):
        dt = datetime.fromtimestamp(s.get("airingAt", 0), tz=timezone.utc)
        return {
            "title":   s.get("title_english") or s.get("title_romaji", ""),
            "episode": s.get("episode"),
            "time":    dt.strftime("%H:%M UTC"),
            "day":     dt.strftime("%A"),
        }

    schedule_today    = [fmt(s) for s in schedules if today_s    <= s.get("airingAt", 0) <= today_e]
    schedule_tomorrow = [fmt(s) for s in schedules if tomorrow_s <= s.get("airingAt", 0) <= tomorrow_e]
    schedule_week     = [fmt(s) for s in schedules if today_s    <= s.get("airingAt", 0) <= week_e]

    recommendations = _recommendations(planning, exclude_ids, genre_counter)

    return {
        "username":          username,
        "favorite_genres":   [g for g, _ in genre_counter.most_common(8)],
        "average_score":     avg_score,
        "watching":          [_fmt(a) for a in watching],
        "completed":         [_fmt(a) for a in completed],
        "planning":          [_fmt(a) for a in planning],
        "paused":            [_fmt(a) for a in paused],
        "top_rated":         [_fmt(a) for a in top_rated],
        "completed_count":   len(completed),
        "schedule_today":    schedule_today,
        "schedule_tomorrow": schedule_tomorrow,
        "schedule_this_week": schedule_week,
        "recommendations":   recommendations,
    }


def _title(a: Dict) -> str:
    return a.get("title_english") or a.get("title_romaji") or a.get("title") or ""


def _fmt(a: Dict) -> Dict:
    return {
        "title":    _title(a),
        "score":    a.get("score") or a.get("userScore") or 0,
        "genres":   ", ".join((a.get("genres") or [])[:4]),
        "episodes": a.get("episodes") or "?",
        "status":   a.get("status", ""),
        "image":    a.get("coverImage") or "",
        "id":       str(a.get("mediaId") or a.get("id") or ""),
        "progress": a.get("progress") or 0,
    }


def _recommendations(planning: List[Dict], exclude_ids: set, genre_counter: Counter) -> List[Dict]:
    """
    Build recommendation list from PLANNING only.
    Strictly excludes anything in exclude_ids (completed/watching/dropped).
    """
    top_genres = {g for g, _ in genre_counter.most_common(5)}
    candidates = []

    for a in planning:
        aid = str(a.get("mediaId") or a.get("id") or "")
        title_key = _title(a).lower().strip()

        # Double-check exclusion
        if aid in exclude_ids or title_key in exclude_ids:
            continue

        score = a.get("meanScore") or a.get("score") or 0
        genres = set(a.get("genres") or [])
        overlap = len(genres & top_genres)
        popularity = a.get("popularity") or 9999999
        is_gem = score >= 80 and popularity < 50000

        reasons = []
        if overlap > 0:
            matched = list(genres & top_genres)[:2]
            reasons.append(f"matches your fav genres ({', '.join(matched)})")
        if is_gem:
            reasons.append("hidden gem")
        if score >= 85:
            reasons.append(f"highly rated ({score}/100)")

        candidates.append({
            **_fmt(a),
            "mean_score":    score,
            "popularity":    popularity,
            "reason":        " · ".join(reasons) if reasons else "in your planning list",
            "is_gem":        is_gem,
            "genre_overlap": overlap,
        })

    candidates.sort(key=lambda x: (x["genre_overlap"], x["mean_score"]), reverse=True)
    return candidates[:15]
