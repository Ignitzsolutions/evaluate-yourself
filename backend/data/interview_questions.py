"""
Interview questions bank from interview_questions_bank.json
Total: 150 questions
Organized by interview type (behavioral, technical, mixed)
"""

from typing import Dict, List, Any
import random

BEHAVIORAL_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "bh_j_001",
        "text": 'Tell me about yourself and what you’re working on currently.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['intro'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_002",
        "text": 'Describe a time you learned something new quickly.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['learning'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_003",
        "text": 'Tell me about a small mistake you made and what you learned.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['growth'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_004",
        "text": 'Describe a time you helped a teammate.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_005",
        "text": 'Tell me about a project you’re proud of. What was your role?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_006",
        "text": 'Describe a time you handled a tight deadline.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['time-management'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_007",
        "text": 'Tell me about a time you received feedback. What did you do with it?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['feedback'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_008",
        "text": 'Describe a situation where requirements changed. How did you adapt?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['adaptability'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_009",
        "text": 'Tell me about a time you had to explain something technical to a non-technical person.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_010",
        "text": 'Describe how you prioritize tasks when you have multiple deadlines.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['prioritization'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001",
        "text": 'Tell me about a conflict with a teammate and how you resolved it.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002",
        "text": 'Describe a time you influenced a decision without authority.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003",
        "text": 'Tell me about a project that failed or was at risk. What did you do?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004",
        "text": 'Describe a time you improved a process. What changed?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_006",
        "text": 'Describe a time you handled an ambiguous problem.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['ambiguity'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_007",
        "text": 'Tell me about a time you mentored or onboarded someone.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['mentoring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_008",
        "text": 'Describe a time you disagreed with a technical decision. What happened?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['disagreement', 'tech'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_009",
        "text": 'Tell me about a time you managed stakeholder expectations.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['stakeholders'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_010",
        "text": 'Describe a time you delivered under significant constraints (time, budget, tech).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['constraints'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_002",
        "text": 'Tell me about a time you made a high-impact technical decision with incomplete information.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['decision-making'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_003",
        "text": 'Describe how you handle competing priorities across teams or org goals.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['prioritization', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_004",
        "text": 'Tell me about a time you improved reliability/quality at scale. What metrics moved?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'metrics'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_005",
        "text": 'Describe a time you handled a critical incident. How did you lead the response?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['incident', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_006",
        "text": 'Tell me about a time you changed a team’s engineering practices. How did you drive adoption?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['change-management'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_007",
        "text": 'Describe a time you resolved a long-running conflict between teams.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['conflict', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_008",
        "text": 'Tell me about a time you hired or evaluated candidates. What criteria did you use?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['hiring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_009",
        "text": 'Describe a time you redesigned a system/process for long-term scalability.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['strategy', 'scaling'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_010",
        "text": 'Tell me about a time you pushed back on a request. How did you communicate it?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['pushback', 'communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_004_v004",
        "text": 'Tell me about a time you improved reliability/quality at scale. What metrics moved? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'metrics'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_009_v007",
        "text": 'Tell me about a time you had to explain something technical to a non-technical person (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v010",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_005_v012",
        "text": 'Tell me about a project you’re proud of. What was your role? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001_v021",
        "text": 'Tell me about a conflict with a teammate and how you resolved it (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003_v024",
        "text": 'Tell me about a project that failed or was at risk. What did you do? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001_v027",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001_v028",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v029",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v031",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v032",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002_v037",
        "text": 'Describe a time you influenced a decision without authority (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_010_v042",
        "text": 'Describe how you prioritize tasks when you have multiple deadlines (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['prioritization'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v044",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002_v046",
        "text": 'Describe a time you influenced a decision without authority (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_008_v047",
        "text": 'Tell me about a time you hired or evaluated candidates. What criteria did you use? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['hiring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v050",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v051",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_002_v052",
        "text": 'Tell me about a time you made a high-impact technical decision with incomplete information (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['decision-making'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001_v056",
        "text": 'Tell me about a conflict with a teammate and how you resolved it (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003_v058",
        "text": 'Tell me about a project that failed or was at risk. What did you do? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_010_v060",
        "text": 'Describe a time you delivered under significant constraints (time, budget, tech) (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['constraints'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
]

TECHNICAL_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "sd_j_001",
        "text": 'Design a URL shortener. What are the core components?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['url-shortener', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_002",
        "text": 'Design a simple file upload service. How do you store files and metadata?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['storage', 'metadata'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_003",
        "text": 'Design a basic notification service (email/SMS).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['notifications', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_004",
        "text": 'Design a leaderboard for a game. What data model would you use?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['leaderboard', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_005",
        "text": 'Design a feature flag service. How do you roll out safely?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['feature-flags', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_006",
        "text": 'Design a rate limiter for a single API endpoint.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['rate-limiting', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_007",
        "text": 'Design a cache layer in front of a database. What gets cached and why?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008",
        "text": 'Design a basic search autocomplete service.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_009",
        "text": 'Design session management for a web app.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_010",
        "text": 'Design an image thumbnailing pipeline.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['media', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_001",
        "text": 'Design a scalable real-time chat system. Walk through trade-offs.',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['realtime', 'websocket', 'scaling'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_002",
        "text": 'Design a feed system (like Twitter). How do you handle fanout?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_003",
        "text": 'Design an analytics event pipeline. How do you ensure reliability?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_004",
        "text": 'Design a multi-tenant SaaS architecture. How do you isolate tenants?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['multi-tenant', 'isolation'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_005",
        "text": 'Design an API gateway. What concerns does it handle?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['gateway', 'routing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006",
        "text": 'Design a job scheduler and worker system.',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_007",
        "text": 'Design a payment processing system. What are the failure modes?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['payments', 'reliability'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_008",
        "text": 'Design a document collaboration system. How do you handle conflicts?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['collaboration', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_009",
        "text": 'Design a recommendation service. How do you evaluate quality?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['recsys', 'metrics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_010",
        "text": 'Design a logging + tracing system. What’s your data model?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_001",
        "text": 'Design a globally distributed low-latency key-value store. Discuss consistency trade-offs.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['distributed-systems', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_002",
        "text": 'Design multi-region active-active architecture for an API. Discuss failover.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['multi-region', 'availability'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_003",
        "text": 'Design a high-throughput event streaming platform. How do you manage backpressure?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['streaming', 'backpressure'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_004",
        "text": 'Design a privacy-preserving analytics system. What guarantees do you provide?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['privacy', 'compliance'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_005",
        "text": 'Design a large-scale search system with ranking. What are major components?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['search', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_006",
        "text": 'Design an experimentation platform (A/B testing) end-to-end.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['experimentation', 'stats'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_007",
        "text": 'Design a service mesh strategy. What problems does it solve?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['service-mesh', 'networking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_008",
        "text": 'Design a massive-scale time-series metrics store.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['timeseries', 'storage'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009",
        "text": 'Design a secure secrets management system.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_010",
        "text": 'Design an ML model serving platform with safe rollout.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['mlops', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_001",
        "text": 'Explain authentication vs authorization with examples.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['security', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_002",
        "text": 'What is idempotency? Give an HTTP example.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'idempotency'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_003",
        "text": "Explain REST principles. What makes an API 'RESTful'?",
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'rest'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_004",
        "text": 'What is a database index and why is it useful?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['db', 'indexes'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_005",
        "text": 'Explain ACID in databases.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['db', 'acid'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_006",
        "text": 'What is caching? When can it hurt?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['cache', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_007",
        "text": 'Explain HTTP status code families (2xx/4xx/5xx).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_008",
        "text": 'Describe how you’d paginate an API.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'pagination'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_009",
        "text": 'What’s the difference between PUT and PATCH?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'methods'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_010",
        "text": 'What is a message queue used for?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['messaging', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_001",
        "text": 'Design a rate-limiting strategy for an API. Where do you enforce it?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['rate-limiting', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_002",
        "text": 'How would you handle database migrations with zero downtime?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'migrations'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_003",
        "text": 'Explain optimistic vs pessimistic locking. When use each?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'locking'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_004",
        "text": 'How do you prevent and handle N+1 queries?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'performance'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_005",
        "text": 'Design an audit log for sensitive actions.',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['security', 'auditing'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_006",
        "text": 'How would you implement distributed tracing? What headers/IDs are needed?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_007",
        "text": 'Explain eventual consistency and a real example.',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['consistency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_008",
        "text": 'How would you implement a webhook delivery system with retries?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['webhooks', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_009",
        "text": 'What are common causes of latency spikes, and how do you debug them?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['performance', 'debugging'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_010",
        "text": 'Design a token-based auth system (JWT/OAuth). What are pitfalls?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['security', 'tokens'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_001",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_002",
        "text": 'Design a high-scale write-heavy system. How do you shard and rebalance?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['sharding', 'scaling'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_003",
        "text": 'How would you enforce idempotency across microservices?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['idempotency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004",
        "text": 'Design an incident response + rollback strategy for risky deployments.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_005",
        "text": 'Design a secure data access layer with fine-grained authorization.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['security', 'authorization'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_006",
        "text": 'How would you build a global rate limiter with fairness?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['rate-limiting', 'global'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_007",
        "text": 'Explain strategies for safe schema evolution in event-driven systems.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['events', 'schema-evolution'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_008",
        "text": 'Design a consistent caching strategy (cache-aside/write-through/write-back). Trade-offs?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['cache', 'consistency'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_009",
        "text": 'How do you do capacity planning for a service with bursty traffic?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['capacity', 'performance'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_010",
        "text": 'Design a disaster recovery plan (RTO/RPO) for critical services.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['dr', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_002_v001",
        "text": 'How would you handle database migrations with zero downtime? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'migrations'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_010_v002",
        "text": 'Design a logging + tracing system. What’s your data model? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_001_v003",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_007_v005",
        "text": 'Design a cache layer in front of a database. What gets cached and why? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_010_v006",
        "text": 'Design an image thumbnailing pipeline (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['media', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_003_v008",
        "text": 'Design an analytics event pipeline. How do you ensure reliability? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_m_007_v009",
        "text": 'Explain eventual consistency and a real example (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['consistency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_008_v011",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_008_v013",
        "text": 'Design a massive-scale time-series metrics store (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['timeseries', 'storage'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_005_v014",
        "text": 'Design a feature flag service. How do you roll out safely? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['feature-flags', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_002_v015",
        "text": 'Design a feed system (like Twitter). How do you handle fanout? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_006_v016",
        "text": 'How would you build a global rate limiter with fairness? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['rate-limiting', 'global'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004_v017",
        "text": 'Design an incident response + rollback strategy for risky deployments (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_009_v018",
        "text": 'Design session management for a web app (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_001_v019",
        "text": 'Explain authentication vs authorization with examples (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['security', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_002_v020",
        "text": 'Design a feed system (like Twitter). How do you handle fanout? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_005_v022",
        "text": 'Design a secure data access layer with fine-grained authorization (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['security', 'authorization'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_008_v023",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006_v025",
        "text": 'Design a job scheduler and worker system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009_v026",
        "text": 'Design a secure secrets management system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008_v030",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_001_v033",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_007_v034",
        "text": 'Design a cache layer in front of a database. What gets cached and why? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009_v035",
        "text": 'Design a secure secrets management system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_006_v036",
        "text": 'Design a rate limiter for a single API endpoint (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['rate-limiting', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_008_v038",
        "text": 'Design a document collaboration system. How do you handle conflicts? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['collaboration', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_008_v039",
        "text": 'Describe how you’d paginate an API (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'pagination'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004_v040",
        "text": 'Design an incident response + rollback strategy for risky deployments (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_009_v041",
        "text": 'Design a recommendation service. How do you evaluate quality? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['recsys', 'metrics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006_v043",
        "text": 'Design a job scheduler and worker system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_010_v045",
        "text": 'What is a message queue used for? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['messaging', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_s_004_v048",
        "text": 'Design a privacy-preserving analytics system. What guarantees do you provide? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['privacy', 'compliance'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_004_v049",
        "text": 'Design a multi-tenant SaaS architecture. How do you isolate tenants? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['multi-tenant', 'isolation'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_005_v053",
        "text": 'Design a large-scale search system with ranking. What are major components? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['search', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_m_008_v054",
        "text": 'How would you implement a webhook delivery system with retries? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['webhooks', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_003_v055",
        "text": 'Design an analytics event pipeline. How do you ensure reliability? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_009_v057",
        "text": 'Design session management for a web app (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008_v059",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
]

MIXED_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "bh_j_001",
        "text": 'Tell me about yourself and what you’re working on currently.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['intro'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_002",
        "text": 'Describe a time you learned something new quickly.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['learning'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_003",
        "text": 'Tell me about a small mistake you made and what you learned.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['growth'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_004",
        "text": 'Describe a time you helped a teammate.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_005",
        "text": 'Tell me about a project you’re proud of. What was your role?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_006",
        "text": 'Describe a time you handled a tight deadline.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['time-management'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_007",
        "text": 'Tell me about a time you received feedback. What did you do with it?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['feedback'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_008",
        "text": 'Describe a situation where requirements changed. How did you adapt?',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['adaptability'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_009",
        "text": 'Tell me about a time you had to explain something technical to a non-technical person.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_010",
        "text": 'Describe how you prioritize tasks when you have multiple deadlines.',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['prioritization'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001",
        "text": 'Tell me about a conflict with a teammate and how you resolved it.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002",
        "text": 'Describe a time you influenced a decision without authority.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003",
        "text": 'Tell me about a project that failed or was at risk. What did you do?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004",
        "text": 'Describe a time you improved a process. What changed?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_006",
        "text": 'Describe a time you handled an ambiguous problem.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['ambiguity'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_007",
        "text": 'Tell me about a time you mentored or onboarded someone.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['mentoring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_008",
        "text": 'Describe a time you disagreed with a technical decision. What happened?',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['disagreement', 'tech'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_009",
        "text": 'Tell me about a time you managed stakeholder expectations.',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['stakeholders'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_010",
        "text": 'Describe a time you delivered under significant constraints (time, budget, tech).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['constraints'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_002",
        "text": 'Tell me about a time you made a high-impact technical decision with incomplete information.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['decision-making'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_003",
        "text": 'Describe how you handle competing priorities across teams or org goals.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['prioritization', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_004",
        "text": 'Tell me about a time you improved reliability/quality at scale. What metrics moved?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'metrics'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_005",
        "text": 'Describe a time you handled a critical incident. How did you lead the response?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['incident', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_006",
        "text": 'Tell me about a time you changed a team’s engineering practices. How did you drive adoption?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['change-management'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_007",
        "text": 'Describe a time you resolved a long-running conflict between teams.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['conflict', 'leadership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_008",
        "text": 'Tell me about a time you hired or evaluated candidates. What criteria did you use?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['hiring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_009",
        "text": 'Describe a time you redesigned a system/process for long-term scalability.',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['strategy', 'scaling'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_010",
        "text": 'Tell me about a time you pushed back on a request. How did you communicate it?',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['pushback', 'communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_004_v004",
        "text": 'Tell me about a time you improved reliability/quality at scale. What metrics moved? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'metrics'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_009_v007",
        "text": 'Tell me about a time you had to explain something technical to a non-technical person (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['communication'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v010",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_005_v012",
        "text": 'Tell me about a project you’re proud of. What was your role? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001_v021",
        "text": 'Tell me about a conflict with a teammate and how you resolved it (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003_v024",
        "text": 'Tell me about a project that failed or was at risk. What did you do? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001_v027",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_001_v028",
        "text": 'Describe a time you led a cross-team initiative. How did you align stakeholders? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['leadership', 'cross-team'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v029",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v031",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v032",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002_v037",
        "text": 'Describe a time you influenced a decision without authority (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_j_010_v042",
        "text": 'Describe how you prioritize tasks when you have multiple deadlines (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "junior",
        "topic_tags": ['prioritization'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v044",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_002_v046",
        "text": 'Describe a time you influenced a decision without authority (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['influence'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_008_v047",
        "text": 'Tell me about a time you hired or evaluated candidates. What criteria did you use? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['hiring'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_005_v050",
        "text": 'Tell me about a time you had to make a trade-off between speed and quality (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['tradeoffs'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_004_v051",
        "text": 'Describe a time you improved a process. What changed? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['process', 'impact'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_s_002_v052",
        "text": 'Tell me about a time you made a high-impact technical decision with incomplete information (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "senior",
        "topic_tags": ['decision-making'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_001_v056",
        "text": 'Tell me about a conflict with a teammate and how you resolved it (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['conflict', 'teamwork'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_003_v058",
        "text": 'Tell me about a project that failed or was at risk. What did you do? (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['risk', 'ownership'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "bh_m_010_v060",
        "text": 'Describe a time you delivered under significant constraints (time, budget, tech) (include assumptions and constraints).',
        "domain": "behavioral",
        "difficulty": "mid",
        "topic_tags": ['constraints'],
        "expected_signals": ['situation', 'specific_actions', 'outcome'],
        "followups_ref": ['behavioral_probe']
    },
    {
        "id": "sd_j_001",
        "text": 'Design a URL shortener. What are the core components?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['url-shortener', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_002",
        "text": 'Design a simple file upload service. How do you store files and metadata?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['storage', 'metadata'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_003",
        "text": 'Design a basic notification service (email/SMS).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['notifications', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_004",
        "text": 'Design a leaderboard for a game. What data model would you use?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['leaderboard', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_005",
        "text": 'Design a feature flag service. How do you roll out safely?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['feature-flags', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_006",
        "text": 'Design a rate limiter for a single API endpoint.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['rate-limiting', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_007",
        "text": 'Design a cache layer in front of a database. What gets cached and why?',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008",
        "text": 'Design a basic search autocomplete service.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_009",
        "text": 'Design session management for a web app.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_010",
        "text": 'Design an image thumbnailing pipeline.',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['media', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_001",
        "text": 'Design a scalable real-time chat system. Walk through trade-offs.',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['realtime', 'websocket', 'scaling'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_002",
        "text": 'Design a feed system (like Twitter). How do you handle fanout?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_003",
        "text": 'Design an analytics event pipeline. How do you ensure reliability?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_004",
        "text": 'Design a multi-tenant SaaS architecture. How do you isolate tenants?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['multi-tenant', 'isolation'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_005",
        "text": 'Design an API gateway. What concerns does it handle?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['gateway', 'routing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006",
        "text": 'Design a job scheduler and worker system.',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_007",
        "text": 'Design a payment processing system. What are the failure modes?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['payments', 'reliability'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_008",
        "text": 'Design a document collaboration system. How do you handle conflicts?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['collaboration', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_009",
        "text": 'Design a recommendation service. How do you evaluate quality?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['recsys', 'metrics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_010",
        "text": 'Design a logging + tracing system. What’s your data model?',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_001",
        "text": 'Design a globally distributed low-latency key-value store. Discuss consistency trade-offs.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['distributed-systems', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_002",
        "text": 'Design multi-region active-active architecture for an API. Discuss failover.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['multi-region', 'availability'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_003",
        "text": 'Design a high-throughput event streaming platform. How do you manage backpressure?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['streaming', 'backpressure'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_004",
        "text": 'Design a privacy-preserving analytics system. What guarantees do you provide?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['privacy', 'compliance'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_005",
        "text": 'Design a large-scale search system with ranking. What are major components?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['search', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_006",
        "text": 'Design an experimentation platform (A/B testing) end-to-end.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['experimentation', 'stats'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_007",
        "text": 'Design a service mesh strategy. What problems does it solve?',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['service-mesh', 'networking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_008",
        "text": 'Design a massive-scale time-series metrics store.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['timeseries', 'storage'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009",
        "text": 'Design a secure secrets management system.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_010",
        "text": 'Design an ML model serving platform with safe rollout.',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['mlops', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_001",
        "text": 'Explain authentication vs authorization with examples.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['security', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_002",
        "text": 'What is idempotency? Give an HTTP example.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'idempotency'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_003",
        "text": "Explain REST principles. What makes an API 'RESTful'?",
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'rest'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_004",
        "text": 'What is a database index and why is it useful?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['db', 'indexes'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_005",
        "text": 'Explain ACID in databases.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['db', 'acid'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_006",
        "text": 'What is caching? When can it hurt?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['cache', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_007",
        "text": 'Explain HTTP status code families (2xx/4xx/5xx).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_008",
        "text": 'Describe how you’d paginate an API.',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'pagination'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_009",
        "text": 'What’s the difference between PUT and PATCH?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['http', 'methods'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_j_010",
        "text": 'What is a message queue used for?',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['messaging', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_001",
        "text": 'Design a rate-limiting strategy for an API. Where do you enforce it?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['rate-limiting', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_002",
        "text": 'How would you handle database migrations with zero downtime?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'migrations'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_003",
        "text": 'Explain optimistic vs pessimistic locking. When use each?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'locking'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_004",
        "text": 'How do you prevent and handle N+1 queries?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'performance'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_005",
        "text": 'Design an audit log for sensitive actions.',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['security', 'auditing'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_006",
        "text": 'How would you implement distributed tracing? What headers/IDs are needed?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_007",
        "text": 'Explain eventual consistency and a real example.',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['consistency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_008",
        "text": 'How would you implement a webhook delivery system with retries?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['webhooks', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_009",
        "text": 'What are common causes of latency spikes, and how do you debug them?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['performance', 'debugging'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_010",
        "text": 'Design a token-based auth system (JWT/OAuth). What are pitfalls?',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['security', 'tokens'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_001",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_002",
        "text": 'Design a high-scale write-heavy system. How do you shard and rebalance?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['sharding', 'scaling'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_003",
        "text": 'How would you enforce idempotency across microservices?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['idempotency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004",
        "text": 'Design an incident response + rollback strategy for risky deployments.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_005",
        "text": 'Design a secure data access layer with fine-grained authorization.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['security', 'authorization'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_006",
        "text": 'How would you build a global rate limiter with fairness?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['rate-limiting', 'global'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_007",
        "text": 'Explain strategies for safe schema evolution in event-driven systems.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['events', 'schema-evolution'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_008",
        "text": 'Design a consistent caching strategy (cache-aside/write-through/write-back). Trade-offs?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['cache', 'consistency'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_009",
        "text": 'How do you do capacity planning for a service with bursty traffic?',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['capacity', 'performance'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_010",
        "text": 'Design a disaster recovery plan (RTO/RPO) for critical services.',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['dr', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_m_002_v001",
        "text": 'How would you handle database migrations with zero downtime? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['db', 'migrations'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_010_v002",
        "text": 'Design a logging + tracing system. What’s your data model? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['observability', 'tracing'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_001_v003",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_007_v005",
        "text": 'Design a cache layer in front of a database. What gets cached and why? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_010_v006",
        "text": 'Design an image thumbnailing pipeline (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['media', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_003_v008",
        "text": 'Design an analytics event pipeline. How do you ensure reliability? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_m_007_v009",
        "text": 'Explain eventual consistency and a real example (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['consistency', 'distributed'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_008_v011",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_008_v013",
        "text": 'Design a massive-scale time-series metrics store (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['timeseries', 'storage'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_005_v014",
        "text": 'Design a feature flag service. How do you roll out safely? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['feature-flags', 'rollout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_002_v015",
        "text": 'Design a feed system (like Twitter). How do you handle fanout? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_006_v016",
        "text": 'How would you build a global rate limiter with fairness? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['rate-limiting', 'global'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004_v017",
        "text": 'Design an incident response + rollback strategy for risky deployments (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_009_v018",
        "text": 'Design session management for a web app (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_001_v019",
        "text": 'Explain authentication vs authorization with examples (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['security', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_002_v020",
        "text": 'Design a feed system (like Twitter). How do you handle fanout? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['feed', 'fanout'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_005_v022",
        "text": 'Design a secure data access layer with fine-grained authorization (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['security', 'authorization'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_008_v023",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006_v025",
        "text": 'Design a job scheduler and worker system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009_v026",
        "text": 'Design a secure secrets management system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008_v030",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_s_001_v033",
        "text": 'Design a multi-tenant database strategy (shared DB vs schema vs DB per tenant). Trade-offs? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['multi-tenant', 'db'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_j_007_v034",
        "text": 'Design a cache layer in front of a database. What gets cached and why? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['cache', 'db'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_009_v035",
        "text": 'Design a secure secrets management system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['security', 'secrets'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_006_v036",
        "text": 'Design a rate limiter for a single API endpoint (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['rate-limiting', 'basics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_008_v038",
        "text": 'Design a document collaboration system. How do you handle conflicts? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['collaboration', 'consistency'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_008_v039",
        "text": 'Describe how you’d paginate an API (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['apis', 'pagination'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "be_s_004_v040",
        "text": 'Design an incident response + rollback strategy for risky deployments (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "senior",
        "topic_tags": ['reliability', 'ops'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_009_v041",
        "text": 'Design a recommendation service. How do you evaluate quality? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['recsys', 'metrics'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_006_v043",
        "text": 'Design a job scheduler and worker system (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['workers', 'queue'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_j_010_v045",
        "text": 'What is a message queue used for? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "junior",
        "topic_tags": ['messaging', 'basics'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_s_004_v048",
        "text": 'Design a privacy-preserving analytics system. What guarantees do you provide? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['privacy', 'compliance'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_m_004_v049",
        "text": 'Design a multi-tenant SaaS architecture. How do you isolate tenants? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['multi-tenant', 'isolation'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_s_005_v053",
        "text": 'Design a large-scale search system with ranking. What are major components? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "senior",
        "topic_tags": ['search', 'ranking'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "be_m_008_v054",
        "text": 'How would you implement a webhook delivery system with retries? (include assumptions and constraints).',
        "domain": "backend",
        "difficulty": "mid",
        "topic_tags": ['webhooks', 'reliability'],
        "expected_signals": ['tradeoffs', 'failure_modes', 'metrics'],
        "followups_ref": ['ask_tradeoffs', 'ask_metrics', 'deep_dive_failure']
    },
    {
        "id": "sd_m_003_v055",
        "text": 'Design an analytics event pipeline. How do you ensure reliability? (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "mid",
        "topic_tags": ['events', 'pipeline'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_009_v057",
        "text": 'Design session management for a web app (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['sessions', 'auth'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
    {
        "id": "sd_j_008_v059",
        "text": 'Design a basic search autocomplete service (include assumptions and constraints).',
        "domain": "system_design",
        "difficulty": "junior",
        "topic_tags": ['search', 'autocomplete'],
        "expected_signals": ['requirements_clarification', 'tradeoffs', 'scaling_strategy', 'failure_modes', 'metrics'],
        "followups_ref": ['clarify_requirements', 'ask_tradeoffs', 'ask_metrics', 'deep_dive_failure', 'raise_bar_design']
    },
]

# ─── Extended Question Bank ────────────────────────────────────────────────────
# Additional questions targeting underrepresented competencies:
# adaptability, communication, ownership, collaboration, problem_solving

EXTENDED_QUESTIONS: List[Dict[str, Any]] = [
    # ── Adaptability (16) ─────────────────────────────────────────────────────
    {"id": "ext_ad_001", "text": "Tell me about a time you had to learn a new technology or framework under a tight deadline. How did you approach it?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["learning", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_002", "text": "Describe a situation where your initial approach to a problem turned out to be wrong. How did you pivot?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["adaptability", "growth"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_003", "text": "Tell me about a time you had to deliver results despite significant ambiguity or changing requirements.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["ambiguity", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_004", "text": "Describe a time you received critical feedback that was difficult to hear. What did you do with it?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["feedback", "growth"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_005", "text": "Tell me about a project that failed or was cancelled. What did you learn from it?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["failure", "growth"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_006", "text": "Describe a time you had to work in a domain or codebase completely outside your comfort zone.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["learning", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_007", "text": "Tell me about a time you had to change your mind after a decision had already been made. What prompted the change?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["change", "decision-making"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_008", "text": "How have you dealt with a sudden shift in company priorities or strategy? What was your role in navigating the change?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["change-management", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_009", "text": "Describe a time you stepped into a new role or took on responsibilities you weren't fully prepared for.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["growth", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_010", "text": "Tell me about a time you had to manage uncertainty while keeping your team aligned and motivated.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["ambiguity", "leadership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_011", "text": "Describe a situation where you had to unlearn something you thought was correct in order to grow.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["learning", "growth"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_012", "text": "Tell me about the most stressful deadline you've worked under. How did you manage your performance and wellbeing?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["pressure", "resilience"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_013", "text": "Describe a time you had to adapt your working style to collaborate with a very different personality type.", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["adaptability", "teamwork"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_014", "text": "Tell me about a time you proactively identified that a technical approach was becoming outdated and led the switch.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["change", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_015", "text": "How do you stay current with evolving tools and techniques in your field? Give a specific recent example.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["learning", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ad_016", "text": "Describe a time you had to deliver a project with a team significantly smaller than needed. How did you manage scope?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["pressure", "adaptability"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    # ── Communication (11) ────────────────────────────────────────────────────
    {"id": "ext_cm_001", "text": "Describe a time you had to explain a complex technical concept to a non-technical stakeholder. How did you approach it?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["communication", "stakeholders"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_002", "text": "Tell me about a situation where written communication caused a misunderstanding. What happened and how did you resolve it?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["communication", "clarity"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_003", "text": "Describe a time you had to deliver bad news to your manager or stakeholders. How did you frame it?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["communication", "stakeholders"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_004", "text": "Tell me about a time your documentation or written design doc significantly helped your team. What made it effective?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["writing", "communication"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_005", "text": "Describe a time you ran a technical presentation or demo that didn't go as planned. What did you do?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["presentation", "communication"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_006", "text": "Tell me about a time you had to align multiple teams or stakeholders with conflicting priorities. How did you communicate?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["stakeholders", "cross-team"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_007", "text": "Describe a time you wrote a post-mortem or incident report. What did you include and how was it received?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["writing", "process"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_008", "text": "Tell me about a time you had to advocate for a technical investment to non-technical leadership. What was the outcome?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["communication", "influence"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_009", "text": "Describe a time you introduced a new process or tool to your team and had to get buy-in. How did you communicate the value?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["communication", "change"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_010", "text": "Tell me about a time you had to give critical feedback to a peer or direct report. How did you approach the conversation?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["feedback", "communication"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_cm_011", "text": "How do you keep distributed or remote team members informed and aligned? Give a concrete example.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["communication", "cross-team"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    # ── Ownership (11) ────────────────────────────────────────────────────────
    {"id": "ext_ow_001", "text": "Tell me about a time you saw a problem that wasn't explicitly your responsibility and chose to own it. What happened?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["ownership", "initiative"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_002", "text": "Describe a time you made a mistake that negatively impacted your team or product. How did you handle it?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["accountability", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_003", "text": "Tell me about a long-running project you drove from idea to production. What kept you going through obstacles?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["delivery", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_004", "text": "Describe a time you set an ambitious goal for yourself or your team and tracked progress toward it. What did you measure?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["goal-setting", "impact"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_005", "text": "Tell me about a time you had to push back on scope creep or protect your team's focus. How did you handle it?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["ownership", "prioritization"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_006", "text": "Describe a time you improved a process or system that was nobody's explicit job to improve.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["initiative", "impact"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_007", "text": "Tell me about a time you led an incident response. What was your role and what did you learn?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["incident", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_008", "text": "Describe a time you took ownership of a system or codebase that was poorly documented or understood. How did you ramp up?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["ownership", "learning"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_009", "text": "Tell me about a technical debt decision you made — took on debt knowingly or paid it down. What drove the choice?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["decision-making", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_010", "text": "Describe a time you managed competing deadlines across multiple projects. How did you decide what to prioritize?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["time-management", "prioritization"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ow_011", "text": "Tell me about a time you had to meet a commitment despite losing key team members or resources mid-project.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["delivery", "resilience"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    # ── Collaboration (10) ────────────────────────────────────────────────────
    {"id": "ext_co_001", "text": "Tell me about a time you worked closely with a designer, PM, or other non-engineer to ship a feature. What made it work?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["teamwork", "cross-functional"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_002", "text": "Describe a time you onboarded a new team member. What did you do to help them ramp up quickly?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["mentoring", "teamwork"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_003", "text": "Tell me about a time you had to coordinate across multiple teams to ship a shared dependency or platform feature.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["cross-functional", "leadership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_004", "text": "Describe a time you disagreed strongly with a technical direction set by your team. How did you handle it?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["disagreement", "conflict"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_005", "text": "Tell me about a time you helped a struggling teammate. What was the situation and what did you do?", "domain": "behavioral", "difficulty": "junior", "topic_tags": ["mentoring", "feedback"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_006", "text": "Describe a time you had to build buy-in for a technical change without having direct authority over the decision.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["influence", "leadership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_007", "text": "Tell me about a time you participated in or drove a hiring process. What did you look for in candidates?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["hiring", "leadership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_008", "text": "Describe a time your team had low morale or was struggling to collaborate. What did you do to improve the dynamic?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["leadership", "teamwork"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_009", "text": "Tell me about a time you pushed back on a product requirement you thought was technically unsound or user-harmful.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["pushback", "communication"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_co_010", "text": "Describe a time when you acted as a bridge between engineering and non-engineering stakeholders. What was the outcome?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["cross-team", "influence"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    # ── Problem Solving (10) ──────────────────────────────────────────────────
    {"id": "ext_ps_001", "text": "Tell me about a time you had to solve a problem with incomplete or contradictory information. How did you proceed?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["ambiguity", "problem-solving"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_002", "text": "Describe a time you identified the root cause of a recurring production issue. What was your debugging process?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["debugging", "problem-solving"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_003", "text": "Tell me about a significant trade-off you made in a system design or architecture decision. How did you evaluate options?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["tradeoffs", "decision-making"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_004", "text": "Describe a time you came up with a creative solution that nobody else on your team had considered.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["problem-solving", "initiative"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_005", "text": "Tell me about a time you had to make a quick decision under time pressure with limited information. What did you decide and why?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["decision-making", "pressure"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_006", "text": "Describe how you break down a complex, multi-month project into milestones. Give a specific example.", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["strategy", "prioritization"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_007", "text": "Tell me about a time you balanced short-term delivery pressure with long-term technical quality. How did you navigate it?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["tradeoffs", "decision-making"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_008", "text": "Describe a time you validated a technical hypothesis through experimentation before committing to a full solution.", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["experimentation", "problem-solving"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_009", "text": "Tell me about a time you identified a risk in a project early and took action to mitigate it. What was the risk?", "domain": "behavioral", "difficulty": "mid", "topic_tags": ["risk", "ownership"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
    {"id": "ext_ps_010", "text": "Describe a time you simplified a system or process that had grown unnecessarily complex. What drove the simplification?", "domain": "behavioral", "difficulty": "senior", "topic_tags": ["problem-solving", "strategy"], "expected_signals": ["situation", "specific_actions", "outcome"], "followups_ref": ["behavioral_probe"]},
]

# Question lookup by ID
ALL_QUESTIONS: List[Dict[str, Any]] = (
    BEHAVIORAL_QUESTIONS +
    TECHNICAL_QUESTIONS +
    EXTENDED_QUESTIONS
)

QUESTIONS_BY_ID: Dict[str, Dict[str, Any]] = {q["id"]: q for q in ALL_QUESTIONS}

def get_questions_by_type_and_difficulty(
    interview_type: str,
    difficulty: str = "mid"
) -> List[Dict[str, Any]]:
    """Get questions filtered by interview type and difficulty."""
    if interview_type == "behavioral":
        questions = BEHAVIORAL_QUESTIONS
    elif interview_type == "technical":
        questions = TECHNICAL_QUESTIONS
    elif interview_type == "mixed":
        questions = MIXED_QUESTIONS
    else:
        questions = MIXED_QUESTIONS
    
    # Filter by difficulty if provided
    if difficulty:
        filtered = [q for q in questions if q["difficulty"] == difficulty]
        # If no questions for this difficulty, return all questions of this type
        if not filtered:
            return questions
        return filtered
    
    return questions

def get_random_question(
    interview_type: str,
    difficulty: str = "mid",
    exclude_ids: List[str] = None
) -> Dict[str, Any]:
    """Get a random question matching the criteria."""
    questions = get_questions_by_type_and_difficulty(interview_type, difficulty)
    
    if exclude_ids:
        questions = [q for q in questions if q["id"] not in exclude_ids]
    
    if not questions:
        # Fallback to all questions of this type (no difficulty filter)
        questions = get_questions_by_type_and_difficulty(interview_type, difficulty=None)
    
    return random.choice(questions) if questions else None
