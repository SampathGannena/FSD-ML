"""
Configuration for ML Recommendation System
"""

# Ensemble Configuration
ENSEMBLE_CONFIG = {
    'default_method': 'context_aware',  # weighted, cascading, context_aware
    
    'weights': {
        'content': 0.3,
        'collaborative': 0.4,
        'gnn': 0.3
    },
    
    # Adaptive weights for different scenarios
    'adaptive_weights': {
        'new_user': {  # streak < 5
            'content': 0.7,
            'collaborative': 0.2,
            'gnn': 0.1
        },
        'active_user': {  # streak > 30
            'content': 0.2,
            'collaborative': 0.4,
            'gnn': 0.4
        },
        'normal_user': {
            'content': 0.3,
            'collaborative': 0.4,
            'gnn': 0.3
        }
    }
}

# Collaborative Filtering Configuration
CF_CONFIG = {
    'n_factors': 20,
    'learning_rate': 0.01,
    'regularization': 0.1,
    'n_iterations': 20,
    'use_svd': True  # True for SVD, False for ALS
}

# GNN Configuration
GNN_CONFIG = {
    'model_type': 'lightgcn',  # lightgcn or graphsage
    'embedding_dim': 64,
    'num_layers': 3,
    'learning_rate': 0.001,
    'epochs': 50,
    'batch_size': 1024,
    'device': 'cpu'  # cpu or cuda
}

# Content-Based Configuration
CONTENT_CONFIG = {
    'max_features': 100,
    'similarity_metric': 'cosine'
}

# Recommendation Configuration
RECOMMENDATION_CONFIG = {
    'default_top_k': 10,
    'max_top_k': 50,
    'min_score_threshold': 0.1,
    'enable_explanations': True
}

# Data Requirements
DATA_REQUIREMENTS = {
    'min_interactions_for_cf': 100,
    'min_interactions_for_gnn': 500,
    'min_users_for_cf': 50,
    'min_users_for_gnn': 200
}

# Cache Configuration
CACHE_CONFIG = {
    'enabled': True,
    'ttl_seconds': 300,  # 5 minutes
    'max_cache_size': 1000
}

# Training Configuration
TRAINING_CONFIG = {
    'auto_retrain': False,
    'retrain_interval_days': 7,
    'min_new_interactions_for_retrain': 1000
}

# Evaluation Configuration
EVALUATION_CONFIG = {
    'k_values': [5, 10, 20],
    'metrics': ['precision', 'recall', 'ndcg', 'hit_rate'],
    'test_split_ratio': 0.2
}

# Logging Configuration
LOGGING_CONFIG = {
    'level': 'INFO',  # DEBUG, INFO, WARNING, ERROR
    'log_predictions': False,
    'log_performance': True
}
