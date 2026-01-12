"""
User Feature Extraction
Builds feature vectors from user profiles for recommendation systems
"""

from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


def extract_user_features(user_doc: Dict) -> Dict:
    """
    Extract features from user MongoDB document
    
    Args:
        user_doc: User document from MongoDB
    
    Returns:
        Dictionary with extracted features
    """
    features = {
        'user_id': str(user_doc.get('_id')),
        'interests': [],
        'skill_level': 'intermediate',
        'streak': user_doc.get('streak', 0),
        'activity_score': 0,
        'goal_categories': [],
        'bio': user_doc.get('bio', '')
    }
    
    # Parse bio or other fields for interests
    bio = user_doc.get('bio', '').lower()
    subjects = ['mathematics', 'programming', 'data-science', 'machine-learning', 
               'web-development', 'algorithms', 'databases']
    
    for subject in subjects:
        subject_keyword = subject.replace('-', ' ')
        if subject_keyword in bio or subject in bio:
            features['interests'].append(subject)
    
    # If no interests found, add default
    if not features['interests']:
        features['interests'] = ['programming']  # Default interest
    
    # Activity score based on streak
    streak = user_doc.get('streak', 0)
    if streak > 30:
        features['activity_score'] = 1.0
        features['skill_level'] = 'advanced'
    elif streak > 10:
        features['activity_score'] = 0.6
        features['skill_level'] = 'intermediate'
    else:
        features['activity_score'] = 0.3
        features['skill_level'] = 'beginner'
    
    return features


def extract_user_features_batch(user_docs: List[Dict]) -> Dict[str, Dict]:
    """
    Extract features for multiple users
    
    Args:
        user_docs: List of user documents
    
    Returns:
        Dictionary mapping user_id to features
    """
    features_map = {}
    
    for user_doc in user_docs:
        user_id = str(user_doc.get('_id'))
        features_map[user_id] = extract_user_features(user_doc)
    
    logger.info(f"Extracted features for {len(features_map)} users")
    return features_map


def extract_mentor_features(mentor_doc: Dict) -> Dict:
    """
    Extract features from mentor MongoDB document
    
    Args:
        mentor_doc: Mentor document from MongoDB
    
    Returns:
        Dictionary with extracted features
    """
    features = {
        '_id': str(mentor_doc.get('_id')),
        'domains': [],
        'experience_level': 'advanced',
        'success_rate': 0.85,  # Default
        'active_mentees': len(mentor_doc.get('groups', [])),
        'availability': 1.0
    }
    
    # Parse domain from domainId or other fields
    domain_id = mentor_doc.get('domainId', '').lower()
    
    # Map domain keywords to subjects
    domain_mapping = {
        'math': 'mathematics',
        'prog': 'programming',
        'code': 'programming',
        'data': 'data-science',
        'ml': 'machine-learning',
        'ai': 'machine-learning',
        'web': 'web-development',
        'algo': 'algorithms',
        'db': 'databases',
        'database': 'databases'
    }
    
    found_domains = []
    for keyword, subject in domain_mapping.items():
        if keyword in domain_id:
            found_domains.append(subject)
    
    features['domains'] = found_domains if found_domains else ['programming']
    
    # Calculate availability based on active mentees
    active_mentees = features['active_mentees']
    features['availability'] = max(0.2, 1.0 - (active_mentees / 10.0))
    
    return features


def extract_session_features(session_doc: Dict) -> Dict:
    """
    Extract features from study session MongoDB document
    
    Args:
        session_doc: StudySession document from MongoDB
    
    Returns:
        Dictionary with extracted features
    """
    features = {
        '_id': str(session_doc.get('_id')),
        'subject': session_doc.get('subject', 'other'),
        'level': session_doc.get('level', 'intermediate'),
        'duration': session_doc.get('duration', 1),
        'current_participants': len(session_doc.get('participants', [])),
        'max_participants': session_doc.get('maxParticipants', 20),
        'organizer_id': str(session_doc.get('organizer')),
        'group_id': str(session_doc.get('group')) if session_doc.get('group') else None
    }
    
    return features


def extract_group_features(group_doc: Dict) -> Dict:
    """
    Extract features from group MongoDB document
    
    Args:
        group_doc: Group document from MongoDB
    
    Returns:
        Dictionary with extracted features
    """
    features = {
        '_id': str(group_doc.get('_id')),
        'category': group_doc.get('category', 'General'),
        'members': [str(m.get('userId')) for m in group_doc.get('members', [])],
        'member_count': len(group_doc.get('members', [])),
        'status': group_doc.get('status', 'active'),
        'settings': group_doc.get('settings', {}),
        'activity_level': 0.5
    }
    
    # Calculate activity level from stats
    stats = group_doc.get('stats', {})
    total_messages = stats.get('totalMessages', 0)
    
    if total_messages > 100:
        features['activity_level'] = 1.0
    elif total_messages > 50:
        features['activity_level'] = 0.7
    elif total_messages > 10:
        features['activity_level'] = 0.5
    else:
        features['activity_level'] = 0.3
    
    return features


def get_user_goal_categories(goals: List[Dict]) -> List[str]:
    """
    Extract goal categories from user's goals
    
    Args:
        goals: List of goal documents for a user
    
    Returns:
        List of unique goal categories
    """
    categories = set()
    
    for goal in goals:
        category = goal.get('category')
        if category:
            categories.add(category)
    
    return list(categories)


def enrich_user_features_with_goals(user_features: Dict, goals: List[Dict]) -> Dict:
    """
    Enrich user features with goal information
    
    Args:
        user_features: Basic user features
        goals: User's goals
    
    Returns:
        Enriched user features
    """
    user_features['goal_categories'] = get_user_goal_categories(goals)
    
    # Extract interests from goals
    for goal in goals:
        title = goal.get('title', '').lower()
        description = goal.get('description', '').lower()
        combined_text = f"{title} {description}"
        
        subjects = ['mathematics', 'programming', 'data-science', 'machine-learning', 
                   'web-development', 'algorithms', 'databases']
        
        for subject in subjects:
            subject_keyword = subject.replace('-', ' ')
            if subject_keyword in combined_text and subject not in user_features['interests']:
                user_features['interests'].append(subject)
    
    return user_features
