"""Job Description (JD) aware question selection helper.

Parses an optional job description text to extract tech stack, domain, and
seniority signals, then returns a filtered subset of question IDs that best
match the JD context.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

try:
    from services.interview.llm_cache import get as cache_get, put as cache_put
except Exception:
    try:
        from backend.services.interview.llm_cache import get as cache_get, put as cache_put
    except Exception:
        cache_get = lambda *a: None  # type: ignore
        cache_put = lambda *a: None  # type: ignore


# ─── Domain keyword maps ──────────────────────────────────────────────────────

_SENIORITY_KEYWORDS: Dict[str, List[str]] = {
    "junior": ["junior", "entry", "associate", "graduate", "intern", "0-2 years", "1 year", "2 years"],
    "mid": ["mid", "intermediate", "3-5 years", "4 years", "3 years", "5 years"],
    "senior": ["senior", "lead", "principal", "staff", "architect", "manager", "6+", "7+", "8+", "10+"],
}

_DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    "technical": [
        "engineer", "developer", "software", "backend", "frontend", "fullstack",
        "devops", "sre", "data", "ml", "machine learning", "ai", "python", "java",
        "react", "node", "cloud", "kubernetes", "infrastructure",
    ],
    "behavioral": [
        "manager", "product", "program", "project", "operations", "hr",
        "business analyst", "consultant", "scrum master",
    ],
    "mixed": ["tech lead", "staff engineer", "principal", "architect"],
}

_TECH_DOMAIN_MAP: Dict[str, str] = {
    "python": "python",
    "java": "java",
    "javascript": "javascript",
    "typescript": "javascript",
    "react": "frontend",
    "angular": "frontend",
    "vue": "frontend",
    "node": "backend",
    "django": "backend",
    "fastapi": "backend",
    "flask": "backend",
    "spring": "java",
    "kubernetes": "devops",
    "docker": "devops",
    "aws": "cloud",
    "azure": "cloud",
    "gcp": "cloud",
    "terraform": "devops",
    "ml": "ml_python",
    "machine learning": "ml_python",
    "deep learning": "ml_python",
    "pytorch": "ml_python",
    "tensorflow": "ml_python",
    "data science": "data_science",
    "sql": "backend",
    "postgres": "backend",
    "mysql": "backend",
    "mongodb": "backend",
}


# ─── LLM client ───────────────────────────────────────────────────────────────

def _get_llm_client():
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError:
        return None, None

    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")

    if azure_key and azure_endpoint and azure_key != "your-azure-openai-api-key-here":
        deployment = (os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "") or "").strip()
        if not deployment:
            return None, None
        try:
            from openai import AzureOpenAI
            return AzureOpenAI(
                api_key=azure_key,
                azure_endpoint=azure_endpoint.rstrip("/"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
            ), deployment
        except Exception:
            return None, None

    if openai_key and openai_key != "your-openai-api-key-here":
        try:
            return OpenAI(api_key=openai_key), os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        except Exception:
            return None, None

    return None, None


_JD_PARSE_PROMPT = """\
Extract key information from the following job description.

Return ONLY a JSON object with these fields:
{{
  "tech_stack": ["list", "of", "technologies"],
  "domain": "technical" | "behavioral" | "mixed",
  "seniority": "junior" | "mid" | "senior",
  "skill_tracks": ["best matching tracks from: python_sql_github_cloud, java_full_stack, ml_python, genai_python_cloud, frontend_react_node, backend_node_python, devops_cloud, data_science"],
  "key_competencies": ["list of 3-5 competencies most important for this role"]
}}

Job Description:
\"\"\"
{jd}
\"\"\"
"""


def _llm_parse_jd(jd: str, client: Any, model: str) -> Optional[Dict]:
    prompt = _JD_PARSE_PROMPT.format(jd=jd[:2000])
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception:
        return None


def _keyword_parse_jd(jd: str) -> Dict:
    """Heuristic JD parsing when LLM is unavailable."""
    lowered = jd.lower()

    # Seniority
    seniority = "mid"
    for level, keywords in _SENIORITY_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            seniority = level
            break

    # Domain
    domain = "mixed"
    for dom, keywords in _DOMAIN_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            domain = dom
            break

    # Tech stack
    tech_stack = [tech for tech in _TECH_DOMAIN_MAP if tech in lowered]

    # Skill tracks
    skill_tracks = list({_TECH_DOMAIN_MAP[t] for t in tech_stack if _TECH_DOMAIN_MAP.get(t)})

    return {
        "tech_stack": tech_stack[:8],
        "domain": domain,
        "seniority": seniority,
        "skill_tracks": skill_tracks[:3],
        "key_competencies": [],
    }


# ─── Public API ───────────────────────────────────────────────────────────────

def parse_jd(job_description: Optional[str]) -> Optional[Dict]:
    """Parse a job description into structured signals.

    Returns None if no JD provided.
    Returns a dict with: tech_stack, domain, seniority, skill_tracks, key_competencies.
    """
    if not job_description or not job_description.strip():
        return None

    jd = job_description.strip()

    cached = cache_get("jd_parse", jd[:500])
    if cached is not None:
        return cached

    client, model = _get_llm_client()
    if client and model:
        result = _llm_parse_jd(jd, client, model)
        if result:
            cache_put("jd_parse", result, jd[:500])
            return result

    result = _keyword_parse_jd(jd)
    cache_put("jd_parse", result, jd[:500])
    return result


def filter_questions_by_jd(
    questions: List[Dict],
    jd_signals: Optional[Dict],
) -> List[Dict]:
    """Filter a question list to prioritize JD-relevant questions.

    Returns the full list if jd_signals is None or empty, otherwise returns
    questions sorted by relevance to the JD (relevant first, rest appended).
    """
    if not jd_signals or not questions:
        return questions

    tech_stack = {t.lower() for t in (jd_signals.get("tech_stack") or [])}
    seniority = (jd_signals.get("seniority") or "mid").lower()

    def _relevance(q: Dict) -> int:
        score = 0
        q_difficulty = (q.get("difficulty") or "").lower()
        q_tags = " ".join(q.get("topic_tags") or []).lower()
        q_text = (q.get("text") or "").lower()

        # Seniority match
        if q_difficulty == seniority:
            score += 3

        # Tech stack overlap
        for tech in tech_stack:
            if tech in q_tags or tech in q_text:
                score += 2

        return score

    scored = sorted(questions, key=_relevance, reverse=True)
    return scored
