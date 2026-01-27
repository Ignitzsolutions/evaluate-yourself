"""Prompt registry keyed by (interview_type, level) or summary variant. Domain as input variable."""

# Summary prompt keys (plan: summary.candidate_speech_v1, summary.interview_improvements_v1)
# Load from content/prompts/summary/*.yaml when YAML loader is added.

SUMMARY_CANDIDATE_SPEECH_V1 = """You are an expert speech and interview coach. Analyze the CANDIDATE's spoken responses in this interview transcript.

Output a JSON object with exactly these keys:
- "accent": 2-4 sentences on accent clarity, comprehensibility, and any tips (e.g. pacing, enunciation).
- "grammar": 2-4 sentences on grammar, word choice, tone (formal/casual), and recurring errors if any.
- "interview_tips": 3-5 concrete, actionable tips for better performance in corporate interviews (e.g. STAR method, concision, confidence, preparation). Number the tips.

Be constructive and specific. Reference the candidate's actual words where useful.

Transcript:
---
{transcript}
---

Respond with only valid JSON, no markdown or extra text."""

SUMMARY_INTERVIEW_IMPROVEMENTS_V1 = """You are a corporate interview coach. Given this interview transcript, provide a short summary to help the candidate improve.

Output a JSON object with exactly these keys:
- "accent": Brief feedback on accent and comprehensibility.
- "grammar": Brief feedback on grammar and professional tone.
- "interview_tips": 3-5 actionable tips for cracking corporate interviews. Be specific.

Transcript:
---
{transcript}
---

Respond with only valid JSON."""


def get_summary_prompt(key: str = "summary.candidate_speech.v1") -> str:
    """Return prompt template for summary pipeline. Key determines which prompt."""
    if "improvement" in key.lower():
        return SUMMARY_INTERVIEW_IMPROVEMENTS_V1
    return SUMMARY_CANDIDATE_SPEECH_V1
