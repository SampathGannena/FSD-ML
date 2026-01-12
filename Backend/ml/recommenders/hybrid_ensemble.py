"""
Hybrid Ensemble Recommendation System
Combines Content-Based, Collaborative Filtering, and GNN recommendations
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

from .content_based import ContentBasedRecommender
from .collaborative_filter import CollaborativeFilter
from .gnn_recommender import GNNRecommender

logger = logging.getLogger(__name__)


class HybridEnsemble:
    """
    Ensemble recommender that combines multiple recommendation strategies
    Supports weighted averaging, cascading, and context-aware routing
    """
    
    def __init__(self, ensemble_method: str = 'weighted'):
        """
        Initialize hybrid ensemble
        
        Args:
            ensemble_method: 'weighted', 'cascading', or 'context_aware'
        """
        self.ensemble_method = ensemble_method
        
        # Initialize individual recommenders
        self.content_based = ContentBasedRecommender()
        self.collaborative = CollaborativeFilter(n_factors=20)
        self.gnn = GNNRecommender(model_type='lightgcn', embedding_dim=64)
        
        # Default weights for weighted ensemble
        self.weights = {
            'content': 0.3,
            'collaborative': 0.4,
            'gnn': 0.3
        }
        
        # Track which models are ready
        self.models_ready = {
            'content': True,  # Content-based always ready
            'collaborative': False,
            'gnn': False
        }
        
        # Performance tracking for adaptive weighting
        self.performance_history = {
            'content': [],
            'collaborative': [],
            'gnn': []
        }
    
    def set_weights(self, content: float = 0.3, collaborative: float = 0.4, 
                   gnn: float = 0.3):
        """
        Set ensemble weights (should sum to 1.0)
        
        Args:
            content: Weight for content-based recommendations
            collaborative: Weight for collaborative filtering
            gnn: Weight for GNN recommendations
        """
        total = content + collaborative + gnn
        self.weights = {
            'content': content / total,
            'collaborative': collaborative / total,
            'gnn': gnn / total
        }
        logger.info(f"Ensemble weights updated: {self.weights}")
    
    def train_collaborative(self, interactions: List[Dict], use_svd: bool = True):
        """
        Train the collaborative filtering model
        
        Args:
            interactions: List of user-item interaction records
            use_svd: Whether to use SVD (True) or ALS (False)
        """
        logger.info("Training collaborative filter...")
        self.collaborative.train(interactions, use_svd=use_svd)
        self.models_ready['collaborative'] = self.collaborative.is_trained
        logger.info("Collaborative filter training complete")
    
    def train_gnn(self, interactions: List[Dict], epochs: int = 50, 
                 learning_rate: float = 0.001):
        """
        Train the GNN model
        
        Args:
            interactions: List of user-item interaction records
            epochs: Number of training epochs
            learning_rate: Learning rate for training
        """
        logger.info("Building graph and training GNN...")
        self.gnn.build_graph(interactions)
        self.gnn.train(interactions, epochs=epochs, learning_rate=learning_rate)
        self.models_ready['gnn'] = self.gnn.is_trained
        logger.info("GNN training complete")
    
    def _normalize_scores(self, scores: List[Tuple[str, float]]) -> Dict[str, float]:
        """
        Normalize scores to [0, 1] range
        
        Args:
            scores: List of (item_id, score) tuples
        
        Returns:
            Dictionary of {item_id: normalized_score}
        """
        if not scores:
            return {}
        
        score_values = [s[1] for s in scores]
        min_score = min(score_values)
        max_score = max(score_values)
        
        if max_score == min_score:
            # All scores are the same
            return {item_id: 0.5 for item_id, _ in scores}
        
        normalized = {}
        for item_id, score in scores:
            norm_score = (score - min_score) / (max_score - min_score)
            normalized[item_id] = norm_score
        
        return normalized
    
    def _weighted_ensemble(self, content_scores: Dict[str, float], 
                          cf_scores: Dict[str, float], 
                          gnn_scores: Dict[str, float]) -> Dict[str, float]:
        """
        Combine scores using weighted average
        
        Returns:
            Dictionary of {item_id: final_score}
        """
        all_items = set(content_scores.keys()) | set(cf_scores.keys()) | set(gnn_scores.keys())
        final_scores = {}
        
        for item_id in all_items:
            score = 0.0
            weight_sum = 0.0
            
            if item_id in content_scores and self.models_ready['content']:
                score += self.weights['content'] * content_scores[item_id]
                weight_sum += self.weights['content']
            
            if item_id in cf_scores and self.models_ready['collaborative']:
                score += self.weights['collaborative'] * cf_scores[item_id]
                weight_sum += self.weights['collaborative']
            
            if item_id in gnn_scores and self.models_ready['gnn']:
                score += self.weights['gnn'] * gnn_scores[item_id]
                weight_sum += self.weights['gnn']
            
            # Normalize by actual weight sum (in case some models didn't predict)
            if weight_sum > 0:
                final_scores[item_id] = score / weight_sum
            else:
                final_scores[item_id] = score
        
        return final_scores
    
    def _cascading_ensemble(self, user_id: str, item_candidates: List[str],
                           user_data: Dict, items_data: List[Dict],
                           top_k: int) -> List[Tuple[str, float]]:
        """
        Cascading approach: Use GNN to filter, then CF to rank, then content to personalize
        
        Returns:
            List of (item_id, score) tuples
        """
        # Stage 1: GNN generates broad candidate set
        if self.models_ready['gnn']:
            gnn_candidates = self.gnn.recommend_items(user_id, item_candidates, 
                                                     top_k=min(len(item_candidates), top_k * 5))
            candidate_ids = [item_id for item_id, _ in gnn_candidates]
            logger.debug(f"GNN filtered to {len(candidate_ids)} candidates")
        else:
            candidate_ids = item_candidates[:top_k * 3]  # Fallback
        
        # Stage 2: Collaborative filtering ranks candidates
        if self.models_ready['collaborative'] and candidate_ids:
            cf_recommendations = self.collaborative.recommend_items(user_id, candidate_ids, 
                                                                   top_k=top_k * 2)
            candidate_ids = [item_id for item_id, _ in cf_recommendations]
            logger.debug(f"CF refined to {len(candidate_ids)} candidates")
        
        # Stage 3: Content-based personalizes final ranking
        # Match candidates with their data
        candidate_items_data = [item for item in items_data 
                               if str(item.get('_id')) in candidate_ids]
        
        if candidate_items_data:
            # Determine item type
            if 'domains' in candidate_items_data[0]:
                final_recs = self.content_based.recommend_mentors(user_data, candidate_items_data, top_k)
            elif 'subject' in candidate_items_data[0]:
                final_recs = self.content_based.recommend_sessions(user_data, candidate_items_data, top_k)
            else:
                final_recs = self.content_based.recommend_groups(user_data, candidate_items_data, top_k)
        else:
            final_recs = [(cid, 0.5) for cid in candidate_ids[:top_k]]
        
        logger.debug(f"Content-based finalized {len(final_recs)} recommendations")
        return final_recs
    
    def _context_aware_routing(self, user_id: str, user_data: Dict, 
                              recommendation_type: str) -> Dict[str, float]:
        """
        Route to different models based on context
        
        Args:
            user_id: User identifier
            user_data: User profile data
            recommendation_type: 'mentor', 'session', or 'group'
        
        Returns:
            Adaptive weights for this context
        """
        adaptive_weights = {'content': 0.3, 'collaborative': 0.4, 'gnn': 0.3}
        
        # New user detection
        user_activity = user_data.get('streak', 0)
        is_new_user = user_activity < 5
        
        if is_new_user:
            # New users: rely more on content-based
            adaptive_weights = {'content': 0.7, 'collaborative': 0.2, 'gnn': 0.1}
            logger.debug(f"New user detected, boosting content-based")
        
        # Active user with rich history
        elif user_activity > 30:
            # Active users: leverage collaborative and GNN more
            adaptive_weights = {'content': 0.2, 'collaborative': 0.4, 'gnn': 0.4}
            logger.debug(f"Active user detected, boosting CF and GNN")
        
        # Recommendation type specific routing
        if recommendation_type == 'mentor':
            # Mentors: domain expertise matters (content-based)
            adaptive_weights['content'] += 0.1
            adaptive_weights['gnn'] -= 0.1
        
        elif recommendation_type == 'group':
            # Groups: social connections matter (GNN)
            adaptive_weights['gnn'] += 0.15
            adaptive_weights['content'] -= 0.15
        
        elif recommendation_type == 'session':
            # Sessions: balance all approaches
            pass  # Keep default adaptive weights
        
        # Normalize
        total = sum(adaptive_weights.values())
        adaptive_weights = {k: v/total for k, v in adaptive_weights.items()}
        
        logger.debug(f"Context-aware weights for {recommendation_type}: {adaptive_weights}")
        return adaptive_weights
    
    def recommend_mentors(self, user_id: str, user_data: Dict, 
                         mentor_candidates: List[Dict], top_k: int = 10,
                         interactions: Optional[List[Dict]] = None) -> List[Tuple[str, float, str]]:
        """
        Recommend mentors using hybrid approach
        
        Args:
            user_id: User identifier
            user_data: User profile dictionary
            mentor_candidates: List of available mentor profiles
            top_k: Number of recommendations
            interactions: Optional interaction history for CF/GNN
        
        Returns:
            List of (mentor_id, score, explanation) tuples
        """
        if not mentor_candidates:
            return []
        
        mentor_ids = [str(m.get('_id')) for m in mentor_candidates]
        
        # Get content-based recommendations
        content_recs = self.content_based.recommend_mentors(user_data, mentor_candidates, 
                                                           top_k=len(mentor_candidates))
        content_scores = self._normalize_scores(content_recs)
        
        # Get collaborative filtering recommendations
        cf_scores = {}
        if self.models_ready['collaborative']:
            cf_recs = self.collaborative.recommend_items(user_id, mentor_ids, 
                                                        top_k=len(mentor_ids))
            cf_scores = self._normalize_scores(cf_recs)
        
        # Get GNN recommendations
        gnn_scores = {}
        if self.models_ready['gnn']:
            gnn_recs = self.gnn.recommend_items(user_id, mentor_ids, 
                                               top_k=len(mentor_ids))
            gnn_scores = self._normalize_scores(gnn_recs)
        
        # Ensemble based on method
        if self.ensemble_method == 'weighted':
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
        
        elif self.ensemble_method == 'context_aware':
            adaptive_weights = self._context_aware_routing(user_id, user_data, 'mentor')
            # Temporarily update weights
            old_weights = self.weights.copy()
            self.weights = adaptive_weights
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
            self.weights = old_weights  # Restore
        
        elif self.ensemble_method == 'cascading':
            cascading_recs = self._cascading_ensemble(user_id, mentor_ids, user_data, 
                                                     mentor_candidates, top_k)
            # Add explanations
            results = []
            for mentor_id, score in cascading_recs:
                mentor_data = next((m for m in mentor_candidates if str(m.get('_id')) == mentor_id), {})
                explanation = self.content_based.explain_recommendation(user_data, mentor_data, 'mentor')
                results.append((mentor_id, score, explanation))
            return results
        
        else:
            final_scores = content_scores  # Fallback
        
        # Sort and get top-k
        ranked_mentors = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        # Add explanations
        results = []
        for mentor_id, score in ranked_mentors:
            mentor_data = next((m for m in mentor_candidates if str(m.get('_id')) == mentor_id), {})
            explanation = self.content_based.explain_recommendation(user_data, mentor_data, 'mentor')
            results.append((mentor_id, score, explanation))
        
        logger.info(f"Generated {len(results)} hybrid mentor recommendations for user {user_id}")
        return results
    
    def recommend_sessions(self, user_id: str, user_data: Dict, 
                          session_candidates: List[Dict], top_k: int = 10) -> List[Tuple[str, float, str]]:
        """
        Recommend study sessions using hybrid approach
        
        Returns:
            List of (session_id, score, explanation) tuples
        """
        if not session_candidates:
            return []
        
        session_ids = [str(s.get('_id')) for s in session_candidates]
        
        # Content-based
        content_recs = self.content_based.recommend_sessions(user_data, session_candidates, 
                                                            top_k=len(session_candidates))
        content_scores = self._normalize_scores(content_recs)
        
        # Collaborative filtering
        cf_scores = {}
        if self.models_ready['collaborative']:
            cf_recs = self.collaborative.recommend_items(user_id, session_ids, 
                                                        top_k=len(session_ids))
            cf_scores = self._normalize_scores(cf_recs)
        
        # GNN
        gnn_scores = {}
        if self.models_ready['gnn']:
            gnn_recs = self.gnn.recommend_items(user_id, session_ids, 
                                               top_k=len(session_ids))
            gnn_scores = self._normalize_scores(gnn_recs)
        
        # Ensemble
        if self.ensemble_method == 'context_aware':
            adaptive_weights = self._context_aware_routing(user_id, user_data, 'session')
            old_weights = self.weights.copy()
            self.weights = adaptive_weights
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
            self.weights = old_weights
        else:
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
        
        # Rank and explain
        ranked_sessions = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        results = []
        for session_id, score in ranked_sessions:
            session_data = next((s for s in session_candidates if str(s.get('_id')) == session_id), {})
            explanation = self.content_based.explain_recommendation(user_data, session_data, 'session')
            results.append((session_id, score, explanation))
        
        logger.info(f"Generated {len(results)} hybrid session recommendations for user {user_id}")
        return results
    
    def recommend_groups(self, user_id: str, user_data: Dict, 
                        group_candidates: List[Dict], top_k: int = 10) -> List[Tuple[str, float, str]]:
        """
        Recommend study groups using hybrid approach
        
        Returns:
            List of (group_id, score, explanation) tuples
        """
        if not group_candidates:
            return []
        
        group_ids = [str(g.get('_id')) for g in group_candidates]
        
        # Content-based
        content_recs = self.content_based.recommend_groups(user_data, group_candidates, 
                                                          top_k=len(group_candidates))
        content_scores = self._normalize_scores(content_recs)
        
        # CF and GNN (groups benefit most from GNN due to network effects)
        cf_scores = {}
        if self.models_ready['collaborative']:
            cf_recs = self.collaborative.recommend_items(user_id, group_ids, 
                                                        top_k=len(group_ids))
            cf_scores = self._normalize_scores(cf_recs)
        
        gnn_scores = {}
        if self.models_ready['gnn']:
            gnn_recs = self.gnn.recommend_items(user_id, group_ids, 
                                               top_k=len(group_ids))
            gnn_scores = self._normalize_scores(gnn_recs)
        
        # For groups, boost GNN weight
        if self.ensemble_method == 'context_aware':
            adaptive_weights = self._context_aware_routing(user_id, user_data, 'group')
            old_weights = self.weights.copy()
            self.weights = adaptive_weights
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
            self.weights = old_weights
        else:
            final_scores = self._weighted_ensemble(content_scores, cf_scores, gnn_scores)
        
        # Rank and explain
        ranked_groups = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        results = []
        for group_id, score in ranked_groups:
            group_data = next((g for g in group_candidates if str(g.get('_id')) == group_id), {})
            explanation = self.content_based.explain_recommendation(user_data, group_data, 'group')
            results.append((group_id, score, explanation))
        
        logger.info(f"Generated {len(results)} hybrid group recommendations for user {user_id}")
        return results
    
    def get_model_status(self) -> Dict[str, bool]:
        """
        Get status of all models in the ensemble
        
        Returns:
            Dictionary showing which models are ready
        """
        return self.models_ready.copy()
    
    def update_performance(self, model_name: str, metric_value: float):
        """
        Update performance history for adaptive weighting
        
        Args:
            model_name: 'content', 'collaborative', or 'gnn'
            metric_value: Performance metric (e.g., precision@10)
        """
        if model_name in self.performance_history:
            self.performance_history[model_name].append(metric_value)
            
            # Keep only recent history
            if len(self.performance_history[model_name]) > 100:
                self.performance_history[model_name] = self.performance_history[model_name][-100:]
            
            logger.debug(f"Updated {model_name} performance: {metric_value:.4f}")
