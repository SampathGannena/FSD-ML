"""
Content-Based Recommender System
Uses feature similarity to recommend items based on content attributes
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class ContentBasedRecommender:
    """
    Recommends items based on content similarity
    Works well for cold-start scenarios and new users
    """
    
    def __init__(self):
        self.tfidf_vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        self.user_profiles = {}
        self.item_features = {}
        self.similarity_cache = {}
        
    def build_user_profile(self, user_data: Dict) -> np.ndarray:
        """
        Build feature vector for a user based on their profile
        
        Args:
            user_data: Dictionary with user attributes
                - interests: list of subjects
                - skill_level: beginner/intermediate/advanced
                - goals: list of learning goals
                - bio: user description
        
        Returns:
            Feature vector representing the user
        """
        features = []
        
        # Subject interests (one-hot encoding)
        subjects = ['mathematics', 'programming', 'data-science', 'machine-learning', 
                   'web-development', 'algorithms', 'databases', 'other']
        user_subjects = user_data.get('interests', [])
        subject_features = [1 if subj in user_subjects else 0 for subj in subjects]
        features.extend(subject_features)
        
        # Skill level (ordinal encoding)
        skill_mapping = {'beginner': 0.33, 'intermediate': 0.66, 'advanced': 1.0}
        skill_level = skill_mapping.get(user_data.get('skill_level', 'intermediate'), 0.66)
        features.append(skill_level)
        
        # Activity level (normalized)
        streak = user_data.get('streak', 0) / 100.0  # Normalize by max expected streak
        features.append(min(streak, 1.0))
        
        # Goal categories
        goal_categories = user_data.get('goal_categories', [])
        categories = ['skill-development', 'career', 'academic', 'project', 'certification']
        goal_features = [1 if cat in goal_categories else 0 for cat in categories]
        features.extend(goal_features)
        
        return np.array(features)
    
    def build_mentor_profile(self, mentor_data: Dict) -> np.ndarray:
        """
        Build feature vector for a mentor
        
        Args:
            mentor_data: Dictionary with mentor attributes
                - domains: list of expertise areas
                - experience_level: expertise level
                - success_rate: percentage of successful mentorships
        
        Returns:
            Feature vector representing the mentor
        """
        features = []
        
        # Domain expertise (one-hot encoding)
        subjects = ['mathematics', 'programming', 'data-science', 'machine-learning', 
                   'web-development', 'algorithms', 'databases', 'other']
        mentor_domains = mentor_data.get('domains', [])
        domain_features = [1 if subj in mentor_domains else 0 for subj in subjects]
        features.extend(domain_features)
        
        # Experience level (always high for mentors)
        features.append(1.0)
        
        # Success rate
        success_rate = mentor_data.get('success_rate', 0.8)
        features.append(success_rate)
        
        # Availability indicators
        active_mentees = mentor_data.get('active_mentees', 0)
        availability_score = max(0, 1 - (active_mentees / 10.0))  # Decreases as mentees increase
        features.append(availability_score)
        
        # Padding to match goal categories
        features.extend([0] * 5)
        
        return np.array(features)
    
    def build_session_profile(self, session_data: Dict) -> np.ndarray:
        """
        Build feature vector for a study session
        
        Args:
            session_data: Dictionary with session attributes
                - subject: session topic
                - level: difficulty level
                - duration: session length
        
        Returns:
            Feature vector representing the session
        """
        features = []
        
        # Subject (one-hot encoding)
        subjects = ['mathematics', 'programming', 'data-science', 'machine-learning', 
                   'web-development', 'algorithms', 'databases', 'other']
        session_subject = session_data.get('subject', 'other')
        subject_features = [1 if subj == session_subject else 0 for subj in subjects]
        features.extend(subject_features)
        
        # Difficulty level
        level_mapping = {'beginner': 0.33, 'intermediate': 0.66, 'advanced': 1.0}
        level = level_mapping.get(session_data.get('level', 'intermediate'), 0.66)
        features.append(level)
        
        # Duration normalized (hours)
        duration = session_data.get('duration', 1) / 4.0  # Normalize by max 4 hours
        features.append(min(duration, 1.0))
        
        # Current participants (popularity)
        participants = session_data.get('current_participants', 0)
        popularity = min(participants / 20.0, 1.0)  # Normalize by max 20
        features.append(popularity)
        
        # Padding to match structure
        features.extend([0] * 4)
        
        return np.array(features)
    
    def calculate_similarity(self, profile1: np.ndarray, profile2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two profiles
        
        Returns:
            Similarity score between 0 and 1
        """
        # Ensure same dimensions
        if len(profile1) != len(profile2):
            min_len = min(len(profile1), len(profile2))
            profile1 = profile1[:min_len]
            profile2 = profile2[:min_len]
        
        # Reshape for sklearn
        profile1 = profile1.reshape(1, -1)
        profile2 = profile2.reshape(1, -1)
        
        similarity = cosine_similarity(profile1, profile2)[0][0]
        return max(0.0, similarity)  # Ensure non-negative
    
    def recommend_mentors(self, user_data: Dict, mentor_list: List[Dict], 
                         top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Recommend mentors for a user based on content similarity
        
        Args:
            user_data: User profile data
            mentor_list: List of available mentors with their data
            top_k: Number of recommendations to return
        
        Returns:
            List of (mentor_id, similarity_score) tuples
        """
        user_profile = self.build_user_profile(user_data)
        recommendations = []
        
        for mentor in mentor_list:
            mentor_profile = self.build_mentor_profile(mentor)
            similarity = self.calculate_similarity(user_profile, mentor_profile)
            
            # Boost score based on mentor quality metrics
            success_boost = mentor.get('success_rate', 0.8) * 0.2
            total_score = similarity * 0.8 + success_boost
            
            recommendations.append((mentor.get('_id'), total_score))
        
        # Sort by score descending
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Generated {len(recommendations)} mentor recommendations for user")
        return recommendations[:top_k]
    
    def recommend_sessions(self, user_data: Dict, session_list: List[Dict], 
                          top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Recommend study sessions for a user based on content similarity
        
        Args:
            user_data: User profile data
            session_list: List of available sessions
            top_k: Number of recommendations to return
        
        Returns:
            List of (session_id, similarity_score) tuples
        """
        user_profile = self.build_user_profile(user_data)
        recommendations = []
        
        for session in session_list:
            session_profile = self.build_session_profile(session)
            similarity = self.calculate_similarity(user_profile, session_profile)
            
            # Adjust for timing and availability
            max_participants = session.get('max_participants', 20)
            current_participants = session.get('current_participants', 0)
            availability = 1.0 - (current_participants / max_participants)
            
            total_score = similarity * 0.9 + availability * 0.1
            
            recommendations.append((session.get('_id'), total_score))
        
        # Sort by score descending
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Generated {len(recommendations)} session recommendations for user")
        return recommendations[:top_k]
    
    def recommend_groups(self, user_data: Dict, group_list: List[Dict], 
                        top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Recommend study groups for a user based on content similarity
        
        Args:
            user_data: User profile data
            group_list: List of available groups
            top_k: Number of recommendations to return
        
        Returns:
            List of (group_id, similarity_score) tuples
        """
        user_interests = set(user_data.get('interests', []))
        recommendations = []
        
        for group in group_list:
            # Group category matching
            category = group.get('category', 'General').lower()
            category_match = 1.0 if category in user_interests else 0.5
            
            # Activity level matching
            member_count = len(group.get('members', []))
            activity_score = min(member_count / 30.0, 1.0)  # Prefer active groups
            
            # Availability
            max_members = group.get('settings', {}).get('maxMembers', 50)
            is_available = member_count < max_members
            
            if is_available:
                total_score = category_match * 0.6 + activity_score * 0.4
                recommendations.append((group.get('_id'), total_score))
        
        # Sort by score descending
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Generated {len(recommendations)} group recommendations for user")
        return recommendations[:top_k]
    
    def explain_recommendation(self, user_data: Dict, item_data: Dict, 
                              item_type: str) -> str:
        """
        Generate human-readable explanation for a recommendation
        
        Args:
            user_data: User profile
            item_data: Recommended item profile
            item_type: 'mentor', 'session', or 'group'
        
        Returns:
            Explanation string
        """
        explanations = []
        
        if item_type == 'mentor':
            user_interests = set(user_data.get('interests', []))
            mentor_domains = set(item_data.get('domains', []))
            common_topics = user_interests.intersection(mentor_domains)
            
            if common_topics:
                explanations.append(f"Expertise in {', '.join(list(common_topics)[:2])}")
            
            success_rate = item_data.get('success_rate', 0)
            if success_rate > 0.8:
                explanations.append(f"{int(success_rate * 100)}% success rate")
        
        elif item_type == 'session':
            if user_data.get('skill_level') == item_data.get('level'):
                explanations.append(f"Matches your {item_data.get('level')} level")
            
            if item_data.get('subject') in user_data.get('interests', []):
                explanations.append(f"Based on your interest in {item_data.get('subject')}")
        
        elif item_type == 'group':
            explanations.append(f"Active group with {len(item_data.get('members', []))} members")
        
        return " • ".join(explanations) if explanations else "Recommended for you"
