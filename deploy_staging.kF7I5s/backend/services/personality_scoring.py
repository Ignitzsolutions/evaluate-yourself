"""
Personality assessment scoring and report generation logic.
All deterministic, template-based - no LLM required.
"""
from typing import List, Dict
from datetime import datetime
from models.personality import (
    TraitScore, DevelopmentArea, CareerFitItem, WorkStyleTip, 
    PersonalityReport, Reflections, Domain, TraitLevel
)
from data.personality_questions import QUESTIONS_BY_ID

# Trait narratives based on level
TRAIT_NARRATIVES = {
    "STRUCTURE": {
        "LOW": "You prefer flexible, adaptable work environments and are comfortable with ambiguity. You thrive when given freedom to explore different approaches.",
        "AVERAGE": "You balance structure with flexibility, adapting to different work styles as needed.",
        "HIGH": "You work best with clear guidelines, structured processes, and well-defined expectations. You value organization and systematic approaches."
    },
    "DETAIL_FOCUS": {
        "LOW": "You focus on the big picture and strategic vision, preferring not to get bogged down in minutiae.",
        "AVERAGE": "You balance attention to detail with maintaining perspective on overall goals.",
        "HIGH": "You have exceptional attention to detail and notice nuances that others might miss. You excel at precision work and quality control."
    },
    "TENACITY": {
        "LOW": "You may shift focus when facing obstacles, preferring to explore alternative paths rather than persist on difficult challenges.",
        "AVERAGE": "You demonstrate moderate persistence, balancing determination with flexibility.",
        "HIGH": "You show strong persistence and determination. You stick with challenges until completion and don't give up easily."
    },
    "STRESS_TOLERANCE": {
        "LOW": "You may find high-pressure situations challenging and prefer working in calm, predictable environments.",
        "AVERAGE": "You handle moderate stress levels reasonably well, with some variation depending on the situation.",
        "HIGH": "You remain calm and effective under pressure. You perform well in high-stakes situations and tight deadlines."
    },
    "DECISIVENESS": {
        "LOW": "You prefer to gather extensive information and consider multiple options before making decisions.",
        "AVERAGE": "You balance thorough consideration with timely decision-making.",
        "HIGH": "You make decisions quickly and confidently, trusting your judgment and moving forward without excessive deliberation."
    },
    "ADAPTABILITY": {
        "LOW": "You prefer consistency and predictability, finding comfort in established routines.",
        "AVERAGE": "You adapt to change reasonably well, though you may prefer some stability.",
        "HIGH": "You are highly adaptable and flexible, easily adjusting to new situations, changes, and unexpected circumstances."
    },
    "APPROACHABILITY": {
        "LOW": "You tend to keep your distance and prefer more formal or independent work interactions.",
        "AVERAGE": "You are reasonably approachable, balancing accessibility with personal boundaries.",
        "HIGH": "You are highly approachable and welcoming. People feel comfortable coming to you with questions, concerns, or ideas."
    },
    "ASSERTIVENESS": {
        "LOW": "You tend to be more reserved in expressing opinions and prefer to observe or follow others' lead.",
        "AVERAGE": "You express your views when appropriate, balancing assertiveness with collaboration.",
        "HIGH": "You confidently express your opinions, take initiative, and are comfortable leading discussions and making your voice heard."
    },
    "LISTENING": {
        "LOW": "You may focus more on expressing your own views than fully hearing others' perspectives.",
        "AVERAGE": "You listen reasonably well, though there's room to improve active listening skills.",
        "HIGH": "You are an excellent listener who actively engages with others' ideas, remembers details, and seeks to understand different perspectives."
    },
    "CREATIVITY": {
        "LOW": "You prefer established, proven methods and solutions over experimental approaches.",
        "AVERAGE": "You balance creative thinking with practical considerations.",
        "HIGH": "You are highly creative and enjoy brainstorming, thinking outside the box, and exploring innovative solutions to problems."
    },
    "CHANGE_PREFERENCE": {
        "LOW": "You prefer stability and consistency, finding comfort in familiar routines and established ways of working.",
        "AVERAGE": "You accept change when necessary but prefer some stability in your work environment.",
        "HIGH": "You welcome change and new opportunities, getting excited about trying new things and exploring different approaches."
    },
    "PRACTICALITY": {
        "LOW": "You may focus more on theoretical concepts, ideal solutions, or abstract thinking.",
        "AVERAGE": "You balance practical considerations with theoretical understanding.",
        "HIGH": "You focus on practical, achievable solutions that work in the real world. You prioritize getting things done effectively."
    }
}

# Development area suggestions
DEVELOPMENT_TEMPLATES = {
    "LISTENING": {
        "description": "Enhancing active listening skills can improve collaboration and understanding.",
        "suggestions": [
            "Practice summarizing what others say before responding",
            "Ask clarifying questions to ensure understanding",
            "Minimize distractions during conversations"
        ]
    },
    "STRESS_TOLERANCE": {
        "description": "Building resilience to stress can improve performance under pressure.",
        "suggestions": [
            "Develop stress management techniques (breathing, mindfulness)",
            "Break large tasks into smaller, manageable steps",
            "Practice time management and prioritization"
        ]
    },
    "ASSERTIVENESS": {
        "description": "Increasing assertiveness can help you contribute more effectively to discussions.",
        "suggestions": [
            "Practice expressing opinions in low-stakes situations",
            "Prepare talking points before meetings",
            "Start with small contributions and build confidence"
        ]
    },
    "ADAPTABILITY": {
        "description": "Improving adaptability can help you thrive in changing environments.",
        "suggestions": [
            "Expose yourself to new situations gradually",
            "Practice reframing challenges as opportunities",
            "Develop a growth mindset toward change"
        ]
    },
    "DECISIVENESS": {
        "description": "Becoming more decisive can improve efficiency and leadership.",
        "suggestions": [
            "Set time limits for decision-making",
            "Focus on 'good enough' rather than perfect solutions",
            "Practice making small decisions quickly"
        ]
    },
    "STRUCTURE": {
        "description": "Developing comfort with flexibility can expand your work opportunities.",
        "suggestions": [
            "Practice working with minimal guidelines",
            "Embrace ambiguity as a learning opportunity",
            "Focus on outcomes rather than specific processes"
        ]
    },
    "DETAIL_FOCUS": {
        "description": "Balancing detail focus with big-picture thinking can enhance effectiveness.",
        "suggestions": [
            "Set aside dedicated time for detail work",
            "Practice stepping back to see the overall context",
            "Delegate detail review when appropriate"
        ]
    }
}

# Career fit templates
CAREER_FIT_TEMPLATES = {
    "STRUCTURE": {
        "thrives": ["Roles with clear processes and defined expectations", "Environments with established workflows and guidelines"],
        "challenges": ["Highly ambiguous or constantly changing work environments", "Roles requiring frequent improvisation"]
    },
    "CREATIVITY": {
        "thrives": ["Innovation-focused roles and creative problem-solving", "Environments that encourage experimentation"],
        "challenges": ["Highly regimented, rule-bound environments", "Roles requiring strict adherence to established methods"]
    },
    "STRESS_TOLERANCE": {
        "thrives": ["High-pressure, fast-paced environments", "Roles with tight deadlines and critical decisions"],
        "challenges": ["Consistently high-stress situations without support", "Environments with unpredictable crisis management"]
    },
    "ADAPTABILITY": {
        "thrives": ["Dynamic, changing environments", "Roles requiring flexibility and quick pivots"],
        "challenges": ["Highly rigid, unchanging environments", "Roles with strict, inflexible processes"]
    },
    "ASSERTIVENESS": {
        "thrives": ["Leadership roles and collaborative decision-making", "Environments that value diverse perspectives"],
        "challenges": ["Hierarchical environments where speaking up is discouraged", "Roles requiring passive compliance"]
    },
    "PRACTICALITY": {
        "thrives": ["Results-oriented, execution-focused roles", "Environments that value getting things done"],
        "challenges": ["Theoretical or research-focused roles", "Environments prioritizing abstract concepts over implementation"]
    }
}

# Work style tips
WORK_STYLE_TIPS = {
    "STRUCTURE": "Create your own structure when it's not provided. Use tools like checklists, project plans, and timelines to organize your work.",
    "STRESS_TOLERANCE": "Build in buffer time for unexpected challenges. Develop stress management routines that work for you.",
    "COMMUNICATION": "Match your communication style to your audience. Practice active listening and clear expression of ideas.",
    "ADAPTABILITY": "Embrace change as a learning opportunity. Focus on what you can control and adapt to what you cannot.",
    "CREATIVITY": "Schedule dedicated time for creative thinking. Balance innovation with practical implementation.",
    "DETAIL_FOCUS": "Use systems to manage details without losing sight of the big picture. Delegate detail work when appropriate."
}

def score_traits(answers: List[Dict[str, any]]) -> List[TraitScore]:
    """
    Score personality traits from assessment answers.
    Returns list of TraitScore objects.
    """
    # Group answers by trait
    trait_values: Dict[str, List[float]] = {}
    
    for answer in answers:
        question_id = answer["questionId"]
        value = float(answer["value"])
        
        if question_id not in QUESTIONS_BY_ID:
            continue
            
        question = QUESTIONS_BY_ID[question_id]
        trait = question["trait"]
        reverse = question.get("reverse", False)
        
        # Apply reverse scoring if needed
        if reverse:
            value = 6.0 - value
        
        if trait not in trait_values:
            trait_values[trait] = []
        trait_values[trait].append(value)
    
    # Compute trait scores
    trait_scores = []
    for trait, values in trait_values.items():
        if not values:
            continue
            
        avg_score = sum(values) / len(values)
        
        # Map to level
        if avg_score <= 2.3:
            level: TraitLevel = "LOW"
        elif avg_score <= 3.7:
            level = "AVERAGE"
        else:
            level = "HIGH"
        
        # Determine domain from first question with this trait
        domain: Domain = "ANALYTICAL"  # default
        for q in QUESTIONS_BY_ID.values():
            if q["trait"] == trait:
                domain = q["domain"]
                break
        
        trait_scores.append(TraitScore(
            trait=trait,
            domain=domain,
            score=round(avg_score, 2),
            level=level
        ))
    
    return trait_scores

def generate_development_areas(trait_scores: List[TraitScore]) -> List[DevelopmentArea]:
    """Generate development areas from trait scores (focus on LOW scores)."""
    low_traits = [ts for ts in trait_scores if ts.level == "LOW"]
    
    # Sort by score (lowest first) and take top 5
    low_traits.sort(key=lambda x: x.score)
    development_traits = low_traits[:5]
    
    development_areas = []
    for trait_score in development_traits:
        trait = trait_score.trait
        if trait in DEVELOPMENT_TEMPLATES:
            template = DEVELOPMENT_TEMPLATES[trait]
            development_areas.append(DevelopmentArea(
                trait=trait,
                description=template["description"],
                suggestions=template["suggestions"]
            ))
        else:
            # Generic development area
            development_areas.append(DevelopmentArea(
                trait=trait,
                description=f"Developing {trait.lower().replace('_', ' ')} can enhance your effectiveness.",
                suggestions=[
                    "Seek opportunities to practice this skill",
                    "Find a mentor or role model",
                    "Set specific, measurable goals for improvement"
                ]
            ))
    
    return development_areas

def generate_career_fit(trait_scores: List[TraitScore]) -> tuple[List[CareerFitItem], List[CareerFitItem]]:
    """Generate career fit suggestions based on distinctive traits."""
    # Get most distinctive traits (furthest from average)
    distinctive = sorted(trait_scores, key=lambda x: abs(x.score - 3.0), reverse=True)[:5]
    
    thrives = []
    challenges = []
    
    for trait_score in distinctive:
        trait = trait_score.trait
        if trait in CAREER_FIT_TEMPLATES:
            template = CAREER_FIT_TEMPLATES[trait]
            if trait_score.level in ["HIGH", "AVERAGE"]:
                for item in template["thrives"]:
                    thrives.append(CareerFitItem(description=item))
            if trait_score.level in ["LOW", "AVERAGE"]:
                for item in template["challenges"]:
                    challenges.append(CareerFitItem(description=item))
    
    # Remove duplicates
    seen_thrives = set()
    unique_thrives = []
    for item in thrives:
        if item.description not in seen_thrives:
            seen_thrives.add(item.description)
            unique_thrives.append(item)
    
    seen_challenges = set()
    unique_challenges = []
    for item in challenges:
        if item.description not in seen_challenges:
            seen_challenges.add(item.description)
            unique_challenges.append(item)
    
    return unique_thrives[:5], unique_challenges[:5]

def generate_work_style_tips(trait_scores: List[TraitScore]) -> List[WorkStyleTip]:
    """Generate work style tips based on trait scores."""
    tips = []
    
    # Focus on traits that might need adaptation
    adaptation_traits = [ts for ts in trait_scores if ts.level in ["LOW", "HIGH"]]
    adaptation_traits.sort(key=lambda x: abs(x.score - 3.0), reverse=True)
    
    for trait_score in adaptation_traits[:3]:
        trait = trait_score.trait
        if trait in WORK_STYLE_TIPS:
            tips.append(WorkStyleTip(
                title=f"Adapting Your {trait.replace('_', ' ')} Style",
                description=WORK_STYLE_TIPS[trait]
            ))
    
    return tips

def generate_report(user_id: str, answers: List[Dict[str, any]]) -> PersonalityReport:
    """Generate a complete personality report from assessment answers."""
    # Score traits
    trait_scores = score_traits(answers)
    
    # Generate sections
    development_areas = generate_development_areas(trait_scores)
    thrives, challenges = generate_career_fit(trait_scores)
    work_style_tips = generate_work_style_tips(trait_scores)
    
    # Create report
    report_id = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id[:8]}"
    title = f"Personality Insights – {datetime.now().strftime('%B %Y')}"
    
    return PersonalityReport(
        id=report_id,
        user_id=user_id,
        created_at=datetime.now(),
        title=title,
        trait_scores=trait_scores,
        development_areas=development_areas,
        career_fit_thrives=thrives,
        career_fit_challenges=challenges,
        work_style_tips=work_style_tips,
        reflections=Reflections()
    )

