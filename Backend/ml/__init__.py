"""
Initialization module for ML recommendation package
"""

from .recommenders.content_based import ContentBasedRecommender
from .recommenders.collaborative_filter import CollaborativeFilter
from .recommenders.gnn_recommender import GNNRecommender
from .recommenders.hybrid_ensemble import HybridEnsemble

__version__ = '1.0.0'
__all__ = [
    'ContentBasedRecommender',
    'CollaborativeFilter',
    'GNNRecommender',
    'HybridEnsemble'
]
