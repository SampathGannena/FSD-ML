"""
Collaborative Filtering Recommender System
Uses matrix factorization (SVD/ALS) for implicit feedback
"""

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class CollaborativeFilter:
    """
    Collaborative filtering using Matrix Factorization
    Learns latent factors from user-item interactions
    """
    
    def __init__(self, n_factors: int = 20, learning_rate: float = 0.01, 
                 regularization: float = 0.1, n_iterations: int = 20):
        """
        Initialize collaborative filter
        
        Args:
            n_factors: Number of latent factors
            learning_rate: Learning rate for gradient descent
            regularization: Regularization parameter to prevent overfitting
            n_iterations: Number of training iterations
        """
        self.n_factors = n_factors
        self.learning_rate = learning_rate
        self.regularization = regularization
        self.n_iterations = n_iterations
        
        # Model parameters
        self.user_factors = None
        self.item_factors = None
        self.user_bias = None
        self.item_bias = None
        self.global_bias = 0
        
        # Mappings
        self.user_id_map = {}
        self.item_id_map = {}
        self.reverse_user_map = {}
        self.reverse_item_map = {}
        
        self.is_trained = False
    
    def _create_interaction_matrix(self, interactions: List[Dict]) -> csr_matrix:
        """
        Create sparse user-item interaction matrix
        
        Args:
            interactions: List of interaction records
                [{'user_id': '...', 'item_id': '...', 'interaction_type': '...', 'weight': 1.0}]
        
        Returns:
            Sparse interaction matrix
        """
        # Create user and item mappings
        unique_users = sorted(set([i['user_id'] for i in interactions]))
        unique_items = sorted(set([i['item_id'] for i in interactions]))
        
        self.user_id_map = {user_id: idx for idx, user_id in enumerate(unique_users)}
        self.item_id_map = {item_id: idx for idx, item_id in enumerate(unique_items)}
        self.reverse_user_map = {idx: user_id for user_id, idx in self.user_id_map.items()}
        self.reverse_item_map = {idx: item_id for item_id, idx in self.item_id_map.items()}
        
        n_users = len(unique_users)
        n_items = len(unique_items)
        
        # Build interaction matrix
        row_indices = []
        col_indices = []
        data = []
        
        for interaction in interactions:
            user_idx = self.user_id_map[interaction['user_id']]
            item_idx = self.item_id_map[interaction['item_id']]
            
            # Weight different interaction types
            interaction_weights = {
                'view': 1.0,
                'join': 2.0,
                'complete': 3.0,
                'rate_positive': 4.0,
                'bookmark': 2.5
            }
            
            weight = interaction_weights.get(interaction.get('interaction_type', 'view'), 1.0)
            weight *= interaction.get('weight', 1.0)
            
            row_indices.append(user_idx)
            col_indices.append(item_idx)
            data.append(weight)
        
        matrix = csr_matrix((data, (row_indices, col_indices)), 
                           shape=(n_users, n_items))
        
        logger.info(f"Created interaction matrix: {n_users} users x {n_items} items, "
                   f"{len(data)} interactions")
        
        return matrix
    
    def train(self, interactions: List[Dict], use_svd: bool = True):
        """
        Train the collaborative filter model
        
        Args:
            interactions: List of user-item interactions
            use_svd: If True, use SVD; else use ALS (Alternating Least Squares)
        """
        logger.info("Training collaborative filter...")
        
        # Create interaction matrix
        interaction_matrix = self._create_interaction_matrix(interactions)
        
        if interaction_matrix.nnz == 0:
            logger.warning("No interactions found. Cannot train model.")
            return
        
        # Calculate global bias
        self.global_bias = interaction_matrix.data.mean()
        
        if use_svd:
            self._train_svd(interaction_matrix)
        else:
            self._train_als(interaction_matrix)
        
        self.is_trained = True
        logger.info("Training complete")
    
    def _train_svd(self, interaction_matrix: csr_matrix):
        """
        Train using Singular Value Decomposition
        """
        if interaction_matrix is None:
            logger.error("Interaction matrix is None")
            return
        n_users, n_items = interaction_matrix.shape  # type: ignore
        
        # Use sparse SVD
        k = min(self.n_factors, min(n_users, n_items) - 1)
        
        try:
            U, sigma, Vt = svds(interaction_matrix.astype(np.float64), k=k)
            
            # User and item factors
            sigma_sqrt = np.diag(np.sqrt(sigma))
            self.user_factors = U @ sigma_sqrt
            self.item_factors = (sigma_sqrt @ Vt).T
            
            # Initialize biases
            self.user_bias = np.zeros(n_users)
            self.item_bias = np.zeros(n_items)
            
            # Calculate biases
            for i in range(n_users):
                user_interactions = interaction_matrix[i, :].toarray().flatten()
                non_zero = user_interactions > 0
                if non_zero.any():
                    self.user_bias[i] = (user_interactions[non_zero] - self.global_bias).mean()
            
            for j in range(n_items):
                item_interactions = interaction_matrix[:, j].toarray().flatten()
                non_zero = item_interactions > 0
                if non_zero.any():
                    self.item_bias[j] = (item_interactions[non_zero] - self.global_bias).mean()
            
            logger.info(f"SVD training complete with {k} factors")
        
        except Exception as e:
            logger.error(f"SVD training failed: {e}")
            # Fallback to random initialization
            self.user_factors = np.random.randn(n_users, self.n_factors) * 0.1
            self.item_factors = np.random.randn(n_items, self.n_factors) * 0.1
            self.user_bias = np.zeros(n_users)
            self.item_bias = np.zeros(n_items)
    
    def _train_als(self, interaction_matrix: csr_matrix):
        """
        Train using Alternating Least Squares
        """
        if interaction_matrix is None:
            logger.error("Interaction matrix is None")
            return
        n_users, n_items = interaction_matrix.shape  # type: ignore
        
        # Initialize factors randomly
        self.user_factors = np.random.randn(n_users, self.n_factors) * 0.1
        self.item_factors = np.random.randn(n_items, self.n_factors) * 0.1
        self.user_bias = np.zeros(n_users)
        self.item_bias = np.zeros(n_items)
        
        # ALS iterations
        for iteration in range(self.n_iterations):
            # Update user factors
            for u in range(n_users):
                user_items = interaction_matrix[u, :].toarray().flatten()
                item_indices = np.where(user_items > 0)[0]
                
                if len(item_indices) > 0:
                    A = self.item_factors[item_indices, :]
                    b = user_items[item_indices] - self.global_bias - self.item_bias[item_indices]
                    
                    # Solve with regularization
                    AtA = A.T @ A + self.regularization * np.eye(self.n_factors)
                    Atb = A.T @ b
                    self.user_factors[u, :] = np.linalg.solve(AtA, Atb)
            
            # Update item factors
            for i in range(n_items):
                item_users = interaction_matrix[:, i].toarray().flatten()
                user_indices = np.where(item_users > 0)[0]
                
                if len(user_indices) > 0:
                    A = self.user_factors[user_indices, :]
                    b = item_users[user_indices] - self.global_bias - self.user_bias[user_indices]
                    
                    # Solve with regularization
                    AtA = A.T @ A + self.regularization * np.eye(self.n_factors)
                    Atb = A.T @ b
                    self.item_factors[i, :] = np.linalg.solve(AtA, Atb)
            
            # Update biases
            for u in range(n_users):
                user_items = interaction_matrix[u, :].toarray().flatten()
                item_indices = np.where(user_items > 0)[0]
                if len(item_indices) > 0:
                    predictions = self.user_factors[u, :] @ self.item_factors[item_indices, :].T
                    self.user_bias[u] = (user_items[item_indices] - self.global_bias - predictions).mean()
            
            for i in range(n_items):
                item_users = interaction_matrix[:, i].toarray().flatten()
                user_indices = np.where(item_users > 0)[0]
                if len(user_indices) > 0:
                    predictions = self.user_factors[user_indices, :] @ self.item_factors[i, :]
                    self.item_bias[i] = (item_users[user_indices] - self.global_bias - predictions).mean()
            
            if (iteration + 1) % 5 == 0:
                logger.info(f"ALS iteration {iteration + 1}/{self.n_iterations}")
        
        logger.info("ALS training complete")
    
    def predict(self, user_id: str, item_ids: List[str]) -> np.ndarray:
        """
        Predict interaction scores for user-item pairs
        
        Args:
            user_id: User identifier
            item_ids: List of item identifiers
        
        Returns:
            Array of predicted scores
        """
        if not self.is_trained:
            logger.warning("Model not trained. Returning zeros.")
            return np.zeros(len(item_ids))
        
        if user_id not in self.user_id_map:
            # Cold start: return item popularity
            logger.debug(f"User {user_id} not in training data (cold start)")
            if self.item_bias is not None:
                return np.array([self.global_bias + self.item_bias[self.item_id_map.get(item_id, 0)] 
                               if item_id in self.item_id_map else self.global_bias 
                               for item_id in item_ids])
            else:
                return np.array([self.global_bias for _ in item_ids])
        
        user_idx = self.user_id_map[user_id]
        predictions = []
        
        for item_id in item_ids:
            if item_id not in self.item_id_map:
                # Item not seen during training
                if self.user_bias is not None:
                    predictions.append(self.global_bias + self.user_bias[user_idx])
                else:
                    predictions.append(self.global_bias)
            else:
                item_idx = self.item_id_map[item_id]
                # Prediction = global_bias + user_bias + item_bias + user_factors · item_factors
                if (self.user_bias is not None and self.item_bias is not None and 
                    self.user_factors is not None and self.item_factors is not None):
                    score = (self.global_bias + 
                            self.user_bias[user_idx] + 
                            self.item_bias[item_idx] + 
                            self.user_factors[user_idx, :] @ self.item_factors[item_idx, :])
                    predictions.append(score)
                else:
                    predictions.append(self.global_bias)
        
        return np.array(predictions)
    
    def recommend_items(self, user_id: str, item_candidates: List[str], 
                       top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Recommend items for a user
        
        Args:
            user_id: User identifier
            item_candidates: List of candidate item IDs to rank
            top_k: Number of recommendations to return
        
        Returns:
            List of (item_id, predicted_score) tuples
        """
        if not item_candidates:
            return []
        
        # Get predictions
        scores = self.predict(user_id, item_candidates)
        
        # Create recommendations
        recommendations = list(zip(item_candidates, scores))
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Generated {len(recommendations)} CF recommendations for user {user_id}")
        
        return recommendations[:top_k]
    
    def get_similar_items(self, item_id: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Find similar items based on learned factors
        
        Args:
            item_id: Item identifier
            top_k: Number of similar items to return
        
        Returns:
            List of (item_id, similarity_score) tuples
        """
        if not self.is_trained or item_id not in self.item_id_map or self.item_factors is None:
            return []
        
        item_idx = self.item_id_map[item_id]
        item_vector = self.item_factors[item_idx, :]
        
        # Calculate similarities with all items
        similarities = self.item_factors @ item_vector
        
        # Get top-k (excluding the item itself)
        similar_indices = np.argsort(similarities)[::-1][1:top_k+1]
        
        similar_items = [(self.reverse_item_map[idx], float(similarities[idx])) 
                        for idx in similar_indices if idx in self.reverse_item_map]
        
        return similar_items
    
    def get_user_embedding(self, user_id: str) -> np.ndarray:
        """
        Get learned user embedding vector
        
        Returns:
            User embedding or zero vector if not found
        """
        if not self.is_trained or user_id not in self.user_id_map or self.user_factors is None:
            return np.zeros(self.n_factors)
        
        user_idx = self.user_id_map[user_id]
        return self.user_factors[user_idx, :]
    
    def get_item_embedding(self, item_id: str) -> np.ndarray:
        """
        Get learned item embedding vector
        
        Returns:
            Item embedding or zero vector if not found
        """
        if not self.is_trained or item_id not in self.item_id_map or self.item_factors is None:
            return np.zeros(self.n_factors)
        
        item_idx = self.item_id_map[item_id]
        return self.item_factors[item_idx, :]
