"""
Recommendation API - Python Backend
Main entry point for recommendation system called from Node.js
"""

import sys
import json
import argparse
import logging
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from recommenders.hybrid_ensemble import HybridEnsemble
from data.user_features import extract_user_features, extract_mentor_features, extract_session_features, extract_group_features
from data.interaction_matrix import InteractionMatrixBuilder, build_interaction_matrix_from_db
from data.graph_builder import GraphBuilder, build_graph_from_db

# MongoDB connection
try:
    from pymongo import MongoClient
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False
    MongoClient = None  # type: ignore
    os = None  # type: ignore

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RecommendationAPI:
    """
    Main recommendation API class
    Handles all recommendation requests from Express backend
    """
    
    def __init__(self):
        self.ensemble = HybridEnsemble(ensemble_method='context_aware')
        self.db = None
        self.collections = {}
        self.is_initialized = False
        
        # Connect to MongoDB if available
        if MONGO_AVAILABLE:
            self._connect_db()
    
    def _connect_db(self):
        """Connect to MongoDB"""
        try:
            if not MONGO_AVAILABLE or os is None or MongoClient is None:
                logger.error("MongoDB dependencies not available")
                self.db = None
                return
                
            mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/fsd_ml')  # type: ignore
            client = MongoClient(mongo_uri)  # type: ignore
            self.db = client.get_database()
            
            # Get collections
            self.collections = {
                'users': self.db.users,
                'mentors': self.db.mentors,
                'study_sessions': self.db.studysessions,
                'groups': self.db.groups,
                'mentorship_requests': self.db.mentorshiprequests,
                'goals': self.db.goals
            }
            
            logger.info("Connected to MongoDB successfully")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            self.db = None
    
    def initialize(self, params):
        """Initialize the recommendation system"""
        logger.info("Initializing recommendation system...")
        
        if self.db is None:
            return {"status": "error", "message": "Database not available"}
        
        try:
            # Build interaction matrix
            builder = build_interaction_matrix_from_db(self.collections)
            interactions = builder.get_interactions()
            
            if len(interactions) > 100:
                # Train collaborative filter
                logger.info("Training collaborative filter...")
                self.ensemble.train_collaborative(interactions, use_svd=True)
                
                # Train GNN if enough data
                if len(interactions) > 500:
                    logger.info("Training GNN...")
                    self.ensemble.train_gnn(interactions, epochs=30)
            
            self.is_initialized = True
            
            status = self.ensemble.get_model_status()
            return {
                "status": "success",
                "message": "Recommendation system initialized",
                "models": status,
                "interaction_count": len(interactions)
            }
        
        except Exception as e:
            logger.error(f"Initialization error: {e}")
            return {"status": "error", "message": str(e)}
    
    def recommend_mentors(self, params):
        """Generate mentor recommendations"""
        user_id = params.get('user_id')
        top_k = params.get('top_k', 10)
        
        if not user_id:
            return {"status": "error", "message": "user_id required"}
        
        try:
            # Fetch user data
            user_doc = self.collections['users'].find_one({'_id': user_id})
            if not user_doc:
                return {"status": "error", "message": "User not found"}
            
            user_features = extract_user_features(user_doc)
            
            # Fetch user's goals for enrichment
            goals = list(self.collections['goals'].find({'menteeId': user_id}))
            if goals:
                from data.user_features import enrich_user_features_with_goals
                user_features = enrich_user_features_with_goals(user_features, goals)
            
            # Fetch available mentors
            mentors = list(self.collections['mentors'].find({}))
            mentor_candidates = [extract_mentor_features(m) for m in mentors]
            
            # Get recommendations
            recommendations = self.ensemble.recommend_mentors(
                user_id, user_features, mentor_candidates, top_k=top_k
            )
            
            # Format results
            results = []
            for mentor_id, score, explanation in recommendations:
                mentor_doc = next((m for m in mentors if str(m['_id']) == mentor_id), None)
                if mentor_doc:
                    results.append({
                        'mentor_id': mentor_id,
                        'score': float(score),
                        'explanation': explanation,
                        'mentor_name': mentor_doc.get('fullname'),
                        'mentor_email': mentor_doc.get('email')
                    })
            
            return {
                "status": "success",
                "recommendations": results
            }
        
        except Exception as e:
            logger.error(f"Error in recommend_mentors: {e}")
            return {"status": "error", "message": str(e)}
    
    def recommend_sessions(self, params):
        """Generate session recommendations"""
        user_id = params.get('user_id')
        top_k = params.get('top_k', 10)
        
        try:
            user_doc = self.collections['users'].find_one({'_id': user_id})
            if not user_doc:
                return {"status": "error", "message": "User not found"}
            
            user_features = extract_user_features(user_doc)
            
            # Fetch available sessions (future sessions only)
            from datetime import datetime
            sessions = list(self.collections['study_sessions'].find({
                'sessionDate': {'$gte': datetime.now()}
            }))
            
            session_candidates = [extract_session_features(s) for s in sessions]
            
            # Get recommendations
            recommendations = self.ensemble.recommend_sessions(
                user_id, user_features, session_candidates, top_k=top_k
            )
            
            # Format results
            results = []
            for session_id, score, explanation in recommendations:
                session_doc = next((s for s in sessions if str(s['_id']) == session_id), None)
                if session_doc:
                    results.append({
                        'session_id': session_id,
                        'score': float(score),
                        'explanation': explanation,
                        'title': session_doc.get('title'),
                        'subject': session_doc.get('subject'),
                        'level': session_doc.get('level'),
                        'sessionDate': session_doc.get('sessionDate').isoformat() if session_doc.get('sessionDate') else None
                    })
            
            return {
                "status": "success",
                "recommendations": results
            }
        
        except Exception as e:
            logger.error(f"Error in recommend_sessions: {e}")
            return {"status": "error", "message": str(e)}
    
    def recommend_groups(self, params):
        """Generate group recommendations"""
        user_id = params.get('user_id')
        top_k = params.get('top_k', 10)
        
        try:
            user_doc = self.collections['users'].find_one({'_id': user_id})
            if not user_doc:
                return {"status": "error", "message": "User not found"}
            
            user_features = extract_user_features(user_doc)
            
            # Fetch available groups (active, with space)
            groups = list(self.collections['groups'].find({'status': 'active'}))
            
            # Filter groups user is not already in
            user_groups = set(user_doc.get('groups', []))
            available_groups = [g for g in groups if g.get('name') not in user_groups]
            
            group_candidates = [extract_group_features(g) for g in available_groups]
            
            # Get recommendations
            recommendations = self.ensemble.recommend_groups(
                user_id, user_features, group_candidates, top_k=top_k
            )
            
            # Format results
            results = []
            for group_id, score, explanation in recommendations:
                group_doc = next((g for g in available_groups if str(g['_id']) == group_id), None)
                if group_doc:
                    results.append({
                        'group_id': group_id,
                        'score': float(score),
                        'explanation': explanation,
                        'name': group_doc.get('name'),
                        'category': group_doc.get('category'),
                        'member_count': len(group_doc.get('members', []))
                    })
            
            return {
                "status": "success",
                "recommendations": results
            }
        
        except Exception as e:
            logger.error(f"Error in recommend_groups: {e}")
            return {"status": "error", "message": str(e)}
    
    def train_models(self, params):
        """Train recommendation models"""
        model_type = params.get('model_type', 'all')
        epochs = params.get('epochs', 50)
        
        try:
            builder = build_interaction_matrix_from_db(self.collections)
            interactions = builder.get_interactions()
            
            if model_type in ['all', 'collaborative']:
                logger.info("Training collaborative filter...")
                self.ensemble.train_collaborative(interactions)
            
            if model_type in ['all', 'gnn']:
                logger.info("Training GNN...")
                self.ensemble.train_gnn(interactions, epochs=epochs)
            
            return {
                "status": "success",
                "message": f"Trained {model_type} models",
                "models": self.ensemble.get_model_status()
            }
        
        except Exception as e:
            logger.error(f"Error training models: {e}")
            return {"status": "error", "message": str(e)}
    
    def status(self, params):
        """Get recommendation system status"""
        return {
            "status": "success",
            "initialized": self.is_initialized,
            "models": self.ensemble.get_model_status(),
            "database_connected": self.db is not None
        }


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Recommendation API')
    parser.add_argument('--action', type=str, required=True, help='Action to perform')
    parser.add_argument('--params', type=str, default='{}', help='Parameters as JSON string')
    
    args = parser.parse_args()
    
    try:
        params = json.loads(args.params)
    except json.JSONDecodeError:
        print(json.dumps({"status": "error", "message": "Invalid JSON parameters"}))
        sys.exit(1)
    
    # Initialize API
    api = RecommendationAPI()
    
    # Route to appropriate method
    actions = {
        'initialize': api.initialize,
        'recommend_mentors': api.recommend_mentors,
        'recommend_sessions': api.recommend_sessions,
        'recommend_groups': api.recommend_groups,
        'train_models': api.train_models,
        'status': api.status
    }
    
    if args.action not in actions:
        print(json.dumps({"status": "error", "message": f"Unknown action: {args.action}"}))
        sys.exit(1)
    
    # Execute action
    result = actions[args.action](params)
    
    # Output result as JSON
    print(json.dumps(result))


if __name__ == '__main__':
    main()
