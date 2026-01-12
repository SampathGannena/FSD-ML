"""
Interaction Matrix Builder
Creates interaction matrices from user behavior data
"""

from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class InteractionMatrixBuilder:
    """
    Builds interaction matrices from various user activities
    """
    
    def __init__(self):
        self.interactions = []
    
    def add_mentorship_interactions(self, mentorship_requests: List[Dict]):
        """
        Add interactions from mentorship requests
        
        Args:
            mentorship_requests: List of MentorshipRequest documents
        """
        for request in mentorship_requests:
            user_id = str(request.get('learnerId'))
            mentor_id = str(request.get('mentorId'))
            status = request.get('status')
            
            # Weight based on status
            weights = {
                'accepted': 4.0,
                'pending': 1.0,
                'declined': 0.0,
                'cancelled': 0.5
            }
            
            weight = weights.get(str(status) if status else 'pending', 1.0)
            
            if weight > 0:
                self.interactions.append({
                    'user_id': user_id,
                    'item_id': mentor_id,
                    'interaction_type': f'mentorship_{status}',
                    'weight': weight,
                    'timestamp': request.get('requestDate')
                })
        
        logger.info(f"Added {len(mentorship_requests)} mentorship interactions")
    
    def add_session_interactions(self, study_sessions: List[Dict]):
        """
        Add interactions from study session participation
        
        Args:
            study_sessions: List of StudySession documents
        """
        for session in study_sessions:
            session_id = str(session.get('_id'))
            participants = session.get('participants', [])
            
            for participant in participants:
                user_id = str(participant.get('userId'))
                status = participant.get('status', 'registered')
                
                # Weight based on participation
                weights = {
                    'completed': 3.0,
                    'attended': 2.5,
                    'registered': 1.0,
                    'cancelled': 0.0
                }
                
                weight = weights.get(status, 1.0)
                
                if weight > 0:
                    self.interactions.append({
                        'user_id': user_id,
                        'item_id': session_id,
                        'interaction_type': f'session_{status}',
                        'weight': weight,
                        'timestamp': session.get('sessionDate')
                    })
        
        logger.info(f"Added interactions from {len(study_sessions)} study sessions")
    
    def add_group_interactions(self, groups: List[Dict]):
        """
        Add interactions from group memberships
        
        Args:
            groups: List of Group documents
        """
        for group in groups:
            group_id = str(group.get('_id'))
            members = group.get('members', [])
            
            for member in members:
                user_id = str(member.get('userId'))
                message_count = member.get('messageCount', 0)
                
                # Weight based on activity
                weight = 2.0  # Base weight for joining
                
                # Boost for active participation
                if message_count > 50:
                    weight += 2.0
                elif message_count > 10:
                    weight += 1.0
                elif message_count > 0:
                    weight += 0.5
                
                self.interactions.append({
                    'user_id': user_id,
                    'item_id': group_id,
                    'interaction_type': 'group_membership',
                    'weight': weight,
                    'timestamp': member.get('joinedAt')
                })
        
        logger.info(f"Added interactions from {len(groups)} groups")
    
    def add_goal_interactions(self, goals: List[Dict]):
        """
        Add interactions from mentor-mentee goals
        
        Args:
            goals: List of Goal documents
        """
        for goal in goals:
            mentee_id = str(goal.get('menteeId'))
            mentor_id = str(goal.get('mentorId'))
            status = goal.get('status')
            progress = goal.get('progressPercentage', 0)
            
            # Weight based on goal status and progress
            base_weights = {
                'achieved': 5.0,
                'active': 3.0,
                'delayed': 2.0,
                'cancelled': 0.5
            }
            
            weight = base_weights.get(str(status) if status else 'active', 3.0)
            
            # Boost by progress
            progress_boost = (progress / 100.0) * 2.0
            weight += progress_boost
            
            self.interactions.append({
                'user_id': mentee_id,
                'item_id': mentor_id,
                'interaction_type': f'goal_{status}',
                'weight': weight,
                'timestamp': goal.get('createdAt')
            })
        
        logger.info(f"Added {len(goals)} goal interactions")
    
    def add_session_feedback(self, feedback_records: List[Dict]):
        """
        Add interactions from session feedback
        
        Args:
            feedback_records: List of feedback documents
        """
        for feedback in feedback_records:
            user_id = str(feedback.get('userId'))
            session_id = str(feedback.get('sessionId'))
            rating = feedback.get('rating', 3)
            
            # Weight based on rating (1-5 scale)
            weight = rating / 5.0 * 3.0
            
            interaction_type = 'rate_positive' if rating >= 4 else 'rate_neutral'
            
            self.interactions.append({
                'user_id': user_id,
                'item_id': session_id,
                'interaction_type': interaction_type,
                'weight': weight,
                'timestamp': feedback.get('createdAt')
            })
        
        logger.info(f"Added {len(feedback_records)} feedback interactions")
    
    def get_interactions(self) -> List[Dict]:
        """
        Get all collected interactions
        
        Returns:
            List of interaction dictionaries
        """
        logger.info(f"Total interactions collected: {len(self.interactions)}")
        return self.interactions
    
    def get_interactions_by_type(self, item_type: str) -> List[Dict]:
        """
        Get interactions filtered by item type
        
        Args:
            item_type: 'mentor', 'session', or 'group'
        
        Returns:
            Filtered interactions
        """
        if item_type == 'mentor':
            # Interactions with mentors (from mentorship requests and goals)
            return [i for i in self.interactions 
                   if 'mentorship' in i['interaction_type'] or 'goal' in i['interaction_type']]
        
        elif item_type == 'session':
            # Interactions with sessions
            return [i for i in self.interactions 
                   if 'session' in i['interaction_type']]
        
        elif item_type == 'group':
            # Interactions with groups
            return [i for i in self.interactions 
                   if 'group' in i['interaction_type']]
        
        return []
    
    def clear_interactions(self):
        """Clear all stored interactions"""
        self.interactions = []
        logger.info("Interactions cleared")


def build_interaction_matrix_from_db(db_collections: Dict) -> InteractionMatrixBuilder:
    """
    Build interaction matrix from MongoDB collections
    
    Args:
        db_collections: Dictionary with collection references
            {
                'mentorship_requests': Collection,
                'study_sessions': Collection,
                'groups': Collection,
                'goals': Collection
            }
    
    Returns:
        InteractionMatrixBuilder with all interactions
    """
    builder = InteractionMatrixBuilder()
    
    # Fetch and add mentorship interactions
    if 'mentorship_requests' in db_collections:
        requests = list(db_collections['mentorship_requests'].find({}))
        builder.add_mentorship_interactions(requests)
    
    # Fetch and add session interactions
    if 'study_sessions' in db_collections:
        sessions = list(db_collections['study_sessions'].find({}))
        builder.add_session_interactions(sessions)
    
    # Fetch and add group interactions
    if 'groups' in db_collections:
        groups = list(db_collections['groups'].find({}))
        builder.add_group_interactions(groups)
    
    # Fetch and add goal interactions
    if 'goals' in db_collections:
        goals = list(db_collections['goals'].find({}))
        builder.add_goal_interactions(goals)
    
    logger.info("Interaction matrix built from database")
    return builder
