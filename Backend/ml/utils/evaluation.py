"""
Evaluation Metrics for Recommendation Systems
Calculates precision, recall, NDCG, and other metrics
"""

import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


def precision_at_k(recommendations: List[str], relevant_items: List[str], k: int) -> float:
    """
    Calculate Precision@K
    
    Args:
        recommendations: List of recommended item IDs (ordered)
        relevant_items: List of actually relevant item IDs
        k: Number of top recommendations to consider
    
    Returns:
        Precision@K score
    """
    if k == 0 or not recommendations:
        return 0.0
    
    top_k = recommendations[:k]
    relevant_set = set(relevant_items)
    
    hits = sum(1 for item in top_k if item in relevant_set)
    return hits / k


def recall_at_k(recommendations: List[str], relevant_items: List[str], k: int) -> float:
    """
    Calculate Recall@K
    
    Args:
        recommendations: List of recommended item IDs
        relevant_items: List of actually relevant item IDs
        k: Number of top recommendations to consider
    
    Returns:
        Recall@K score
    """
    if not relevant_items or not recommendations:
        return 0.0
    
    top_k = recommendations[:k]
    relevant_set = set(relevant_items)
    
    hits = sum(1 for item in top_k if item in relevant_set)
    return hits / len(relevant_set)


def average_precision(recommendations: List[str], relevant_items: List[str]) -> float:
    """
    Calculate Average Precision (AP)
    
    Args:
        recommendations: List of recommended item IDs (ordered)
        relevant_items: List of actually relevant item IDs
    
    Returns:
        Average Precision score
    """
    if not relevant_items or not recommendations:
        return 0.0
    
    relevant_set = set(relevant_items)
    score = 0.0
    num_hits = 0
    
    for i, item in enumerate(recommendations):
        if item in relevant_set:
            num_hits += 1
            precision = num_hits / (i + 1)
            score += precision
    
    if num_hits == 0:
        return 0.0
    
    return score / len(relevant_set)


def mean_average_precision(all_recommendations: List[List[str]], 
                          all_relevant: List[List[str]]) -> float:
    """
    Calculate Mean Average Precision (MAP)
    
    Args:
        all_recommendations: List of recommendation lists for each user
        all_relevant: List of relevant item lists for each user
    
    Returns:
        MAP score
    """
    if len(all_recommendations) != len(all_relevant):
        raise ValueError("Recommendations and relevant items must have same length")
    
    ap_scores = []
    for recs, relevant in zip(all_recommendations, all_relevant):
        ap_scores.append(average_precision(recs, relevant))
    
    return float(np.mean(ap_scores)) if ap_scores else 0.0


def ndcg_at_k(recommendations: List[str], relevant_items: List[str], k: int) -> float:
    """
    Calculate Normalized Discounted Cumulative Gain (NDCG@K)
    
    Args:
        recommendations: List of recommended item IDs (ordered)
        relevant_items: List of actually relevant item IDs
        k: Number of top recommendations to consider
    
    Returns:
        NDCG@K score
    """
    if k == 0 or not recommendations or not relevant_items:
        return 0.0
    
    top_k = recommendations[:k]
    relevant_set = set(relevant_items)
    
    # Calculate DCG
    dcg = 0.0
    for i, item in enumerate(top_k):
        if item in relevant_set:
            # Binary relevance: 1 if relevant, 0 otherwise
            dcg += 1.0 / np.log2(i + 2)  # i+2 because i starts at 0
    
    # Calculate IDCG (ideal DCG)
    idcg = 0.0
    for i in range(min(len(relevant_items), k)):
        idcg += 1.0 / np.log2(i + 2)
    
    if idcg == 0:
        return 0.0
    
    return dcg / idcg


def hit_rate_at_k(recommendations: List[str], relevant_items: List[str], k: int) -> float:
    """
    Calculate Hit Rate@K (whether any relevant item is in top-k)
    
    Args:
        recommendations: List of recommended item IDs
        relevant_items: List of actually relevant item IDs
        k: Number of top recommendations to consider
    
    Returns:
        1.0 if hit, 0.0 otherwise
    """
    if not recommendations or not relevant_items:
        return 0.0
    
    top_k = set(recommendations[:k])
    relevant_set = set(relevant_items)
    
    return 1.0 if top_k.intersection(relevant_set) else 0.0


def coverage(all_recommendations: List[List[str]], all_items: List[str]) -> float:
    """
    Calculate catalog coverage (what % of items are ever recommended)
    
    Args:
        all_recommendations: All recommendations made
        all_items: Complete catalog of items
    
    Returns:
        Coverage ratio
    """
    if not all_items:
        return 0.0
    
    recommended_items = set()
    for recs in all_recommendations:
        recommended_items.update(recs)
    
    return len(recommended_items) / len(all_items)


def diversity(recommendations: List[str], item_features: Dict[str, np.ndarray]) -> float:
    """
    Calculate diversity of recommendations (avg pairwise distance)
    
    Args:
        recommendations: List of recommended item IDs
        item_features: Dictionary mapping item_id to feature vector
    
    Returns:
        Diversity score
    """
    if len(recommendations) < 2:
        return 0.0
    
    # Get feature vectors for recommended items
    vectors = []
    for item_id in recommendations:
        if item_id in item_features:
            vectors.append(item_features[item_id])
    
    if len(vectors) < 2:
        return 0.0
    
    # Calculate pairwise cosine distances
    distances = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            # Cosine distance = 1 - cosine similarity
            similarity = np.dot(vectors[i], vectors[j]) / (
                np.linalg.norm(vectors[i]) * np.linalg.norm(vectors[j]) + 1e-10
            )
            distance = 1 - similarity
            distances.append(distance)
    
    return float(np.mean(distances)) if distances else 0.0


def evaluate_recommendations(recommendations: Dict[str, List[str]], 
                             ground_truth: Dict[str, List[str]],
                             k_values: List[int] = [5, 10, 20]) -> Dict:
    """
    Comprehensive evaluation of recommendations
    
    Args:
        recommendations: Dict mapping user_id to recommended item list
        ground_truth: Dict mapping user_id to relevant item list
        k_values: List of k values to evaluate
    
    Returns:
        Dictionary with evaluation metrics
    """
    results = {f'precision@{k}': [] for k in k_values}
    results.update({f'recall@{k}': [] for k in k_values})
    results.update({f'ndcg@{k}': [] for k in k_values})
    results.update({f'hit_rate@{k}': [] for k in k_values})
    
    for user_id in recommendations:
        if user_id not in ground_truth:
            continue
        
        user_recs = recommendations[user_id]
        user_relevant = ground_truth[user_id]
        
        for k in k_values:
            results[f'precision@{k}'].append(precision_at_k(user_recs, user_relevant, k))
            results[f'recall@{k}'].append(recall_at_k(user_recs, user_relevant, k))
            results[f'ndcg@{k}'].append(ndcg_at_k(user_recs, user_relevant, k))
            results[f'hit_rate@{k}'].append(hit_rate_at_k(user_recs, user_relevant, k))
    
    # Calculate means
    metrics = {}
    for metric_name, values in results.items():
        if values:
            metrics[metric_name] = np.mean(values)
        else:
            metrics[metric_name] = 0.0
    
    logger.info(f"Evaluation results: {metrics}")
    return metrics


class RecommendationEvaluator:
    """
    Evaluator class for tracking recommendation performance over time
    """
    
    def __init__(self):
        self.history = []
    
    def evaluate(self, recommendations: Dict[str, List[str]], 
                ground_truth: Dict[str, List[str]],
                model_name: str = 'unknown') -> Dict:
        """
        Evaluate and store results
        
        Returns:
            Evaluation metrics
        """
        metrics = evaluate_recommendations(recommendations, ground_truth)
        metrics['model'] = model_name
        
        self.history.append(metrics)
        return metrics
    
    def get_best_model(self, metric: str = 'ndcg@10'):
        """
        Get best performing model based on a metric
        
        Returns:
            Model name with best performance or None if no history
        """
        if not self.history:
            return None
        
        best_result = max(self.history, key=lambda x: x.get(metric, 0))
        return best_result.get('model', 'unknown')
    
    def compare_models(self) -> Dict:
        """
        Compare all evaluated models
        
        Returns:
            Comparison dictionary
        """
        if not self.history:
            return {}
        
        comparison = {}
        metrics = [k for k in self.history[0].keys() if k != 'model']
        
        for metric in metrics:
            comparison[metric] = {
                result['model']: result[metric] 
                for result in self.history
            }
        
        return comparison
