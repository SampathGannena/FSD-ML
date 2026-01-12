"""
Graph Neural Network Recommender System
Uses GraphSAGE/LightGCN for graph-based recommendations
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

# PyTorch imports (will be optional)
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available. GNN recommender will use fallback mode.")

# PyTorch Geometric imports (optional)
try:
    from torch_geometric.nn import SAGEConv, LGConv
    from torch_geometric.data import Data
    PYGEOMETRIC_AVAILABLE = True
except ImportError:
    PYGEOMETRIC_AVAILABLE = False
    if TORCH_AVAILABLE:
        logger.warning("PyTorch Geometric not available. Install with: pip install torch-geometric")


if TORCH_AVAILABLE:
    _LightGCNBase = nn.Module
else:
    _LightGCNBase = object

class LightGCN(_LightGCNBase):  # type: ignore
    """
    LightGCN model for collaborative filtering on graphs
    Simplified GCN specifically designed for recommendations
    """
    
    def __init__(self, num_users: int, num_items: int, embedding_dim: int = 64, 
                 num_layers: int = 3):
        """
        Initialize LightGCN
        
        Args:
            num_users: Number of users
            num_items: Number of items
            embedding_dim: Dimension of embeddings
            num_layers: Number of graph convolution layers
        """
        if TORCH_AVAILABLE:
            super(LightGCN, self).__init__()
        
        self.num_users = num_users
        self.num_items = num_items
        self.embedding_dim = embedding_dim
        self.num_layers = num_layers
        
        if TORCH_AVAILABLE:
            # User and item embeddings
            self.user_embedding = nn.Embedding(num_users, embedding_dim)
            self.item_embedding = nn.Embedding(num_items, embedding_dim)
            
            # Initialize embeddings
            nn.init.xavier_uniform_(self.user_embedding.weight)
            nn.init.xavier_uniform_(self.item_embedding.weight)
            
            if PYGEOMETRIC_AVAILABLE:
                # LightGCN convolution layers
                self.convs = nn.ModuleList([
                    LGConv() for _ in range(num_layers)
                ])
    
    def forward(self, edge_index):
        """
        Forward pass through the network
        
        Args:
            edge_index: Graph edge indices [2, num_edges]
        
        Returns:
            User and item embeddings
        """
        if not TORCH_AVAILABLE or not PYGEOMETRIC_AVAILABLE:
            return None, None
        
        # Get initial embeddings
        user_emb = self.user_embedding.weight
        item_emb = self.item_embedding.weight
        
        # Concatenate user and item embeddings
        all_emb = torch.cat([user_emb, item_emb], dim=0)
        
        # Store embeddings from each layer
        embs = [all_emb]
        
        # Graph convolutions
        for conv in self.convs:
            all_emb = conv(all_emb, edge_index)
            embs.append(all_emb)
        
        # Average embeddings from all layers
        final_emb = torch.stack(embs, dim=0).mean(dim=0)
        
        # Split back to user and item embeddings
        user_final = final_emb[:self.num_users]
        item_final = final_emb[self.num_users:]
        
        return user_final, item_final
    
    def predict(self, user_indices, item_indices):
        """
        Predict scores for user-item pairs
        
        Args:
            user_indices: User indices tensor
            item_indices: Item indices tensor
        
        Returns:
            Predicted scores
        """
        if not TORCH_AVAILABLE:
            return None
        
        user_emb = self.user_embedding(user_indices)
        item_emb = self.item_embedding(item_indices)
        
        # Dot product
        scores = (user_emb * item_emb).sum(dim=1)
        return scores


if TORCH_AVAILABLE:
    _GraphSAGEBase = nn.Module
else:
    _GraphSAGEBase = object

class GraphSAGERecommender(_GraphSAGEBase):  # type: ignore
    """
    GraphSAGE model for recommendations
    Inductive learning for new nodes
    """
    
    def __init__(self, num_features: int, hidden_dim: int = 64, 
                 num_layers: int = 2):
        """
        Initialize GraphSAGE
        
        Args:
            num_features: Number of input features
            hidden_dim: Hidden dimension size
            num_layers: Number of SAGE layers
        """
        if TORCH_AVAILABLE:
            super(GraphSAGERecommender, self).__init__()
        
        self.num_features = num_features
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        if TORCH_AVAILABLE and PYGEOMETRIC_AVAILABLE:
            # GraphSAGE layers
            self.convs = nn.ModuleList()
            self.convs.append(SAGEConv(num_features, hidden_dim))
            for _ in range(num_layers - 1):
                self.convs.append(SAGEConv(hidden_dim, hidden_dim))
            
            # Output layer
            self.fc = nn.Linear(hidden_dim, hidden_dim)
    
    def forward(self, x, edge_index):
        """
        Forward pass
        
        Args:
            x: Node features [num_nodes, num_features]
            edge_index: Graph edges [2, num_edges]
        
        Returns:
            Node embeddings
        """
        if not TORCH_AVAILABLE or not PYGEOMETRIC_AVAILABLE:
            return None
        
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.convs) - 1:
                x = F.relu(x)
                x = F.dropout(x, p=0.5, training=self.training)
        
        x = self.fc(x)
        return x


class GNNRecommender:
    """
    High-level GNN Recommender interface
    Handles graph construction, training, and inference
    """
    
    def __init__(self, model_type: str = 'lightgcn', embedding_dim: int = 64, 
                 num_layers: int = 3, device: str = 'cpu'):
        """
        Initialize GNN Recommender
        
        Args:
            model_type: 'lightgcn' or 'graphsage'
            embedding_dim: Dimension of embeddings
            num_layers: Number of layers
            device: 'cpu' or 'cuda'
        """
        self.model_type = model_type
        self.embedding_dim = embedding_dim
        self.num_layers = num_layers
        
        if TORCH_AVAILABLE:
            self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        else:
            self.device = 'cpu'
        
        self.model = None
        self.user_id_map = {}
        self.item_id_map = {}
        self.reverse_user_map = {}
        self.reverse_item_map = {}
        self.is_trained = False
        
        # Graph data
        self.edge_index = None
        self.node_features = None
    
    def build_graph(self, interactions: List[Dict], user_features: Optional[Dict] = None,
                   item_features: Optional[Dict] = None):
        """
        Build bipartite graph from interactions
        
        Args:
            interactions: List of user-item interactions
                [{'user_id': '...', 'item_id': '...', 'weight': 1.0}]
            user_features: Optional user feature dict {user_id: features}
            item_features: Optional item feature dict {item_id: features}
        """
        if not TORCH_AVAILABLE:
            logger.error("PyTorch not available. Cannot build graph.")
            return
        
        logger.info("Building interaction graph...")
        
        # Create mappings
        unique_users = sorted(set([i['user_id'] for i in interactions]))
        unique_items = sorted(set([i['item_id'] for i in interactions]))
        
        self.user_id_map = {user_id: idx for idx, user_id in enumerate(unique_users)}
        self.item_id_map = {item_id: idx for idx, item_id in enumerate(unique_items)}
        self.reverse_user_map = {idx: user_id for user_id, idx in self.user_id_map.items()}
        self.reverse_item_map = {idx: item_id for item_id, idx in self.item_id_map.items()}
        
        num_users = len(unique_users)
        num_items = len(unique_items)
        
        # Build edge index for bipartite graph
        edge_list = []
        
        for interaction in interactions:
            user_idx = self.user_id_map[interaction['user_id']]
            item_idx = self.item_id_map[interaction['item_id']] + num_users  # Offset for items
            
            # Bidirectional edges (user->item and item->user)
            edge_list.append([user_idx, item_idx])
            edge_list.append([item_idx, user_idx])
        
        if edge_list:
            self.edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
            self.edge_index = self.edge_index.to(self.device)
        else:
            logger.error("No edges in graph")
            return
        
        # Initialize model
        if self.model_type == 'lightgcn':
            self.model = LightGCN(
                num_users=num_users,
                num_items=num_items,
                embedding_dim=self.embedding_dim,
                num_layers=self.num_layers
            )
        elif self.model_type == 'graphsage':
            # For GraphSAGE, we need node features
            feature_dim = self.embedding_dim
            self.model = GraphSAGERecommender(
                num_features=feature_dim,
                hidden_dim=self.embedding_dim,
                num_layers=self.num_layers
            )
            
            # Initialize random features if not provided
            total_nodes = num_users + num_items
            self.node_features = torch.randn(total_nodes, feature_dim)
            self.node_features = self.node_features.to(self.device)
        
        if self.model and TORCH_AVAILABLE:
            self.model = self.model.to(self.device)
        
        logger.info(f"Graph built: {num_users} users, {num_items} items, "
                   f"{len(edge_list)} edges")
    
    def train(self, interactions: List[Dict], epochs: int = 50, 
             learning_rate: float = 0.001, batch_size: int = 1024):
        """
        Train the GNN model
        
        Args:
            interactions: Training interactions
            epochs: Number of training epochs
            learning_rate: Learning rate
            batch_size: Batch size for training
        """
        if not TORCH_AVAILABLE or self.model is None:
            logger.error("Cannot train: PyTorch or model not available")
            return
        
        logger.info(f"Training {self.model_type} model...")
        
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        
        self.model.train()
        
        for epoch in range(epochs):
            optimizer.zero_grad()
            
            if self.model_type == 'lightgcn':
                user_emb, item_emb = self.model(self.edge_index)
                
                # BPR loss (Bayesian Personalized Ranking)
                # Sample positive and negative pairs
                loss = 0
                num_samples = min(batch_size, len(interactions))
                
                for _ in range(num_samples):
                    interaction = interactions[np.random.randint(len(interactions))]
                    user_idx = self.user_id_map[interaction['user_id']]
                    pos_item_idx = self.item_id_map[interaction['item_id']]
                    
                    # Random negative sample
                    neg_item_idx = np.random.randint(len(self.item_id_map))
                    
                    user_vec = user_emb[user_idx]
                    pos_item_vec = item_emb[pos_item_idx]
                    neg_item_vec = item_emb[neg_item_idx]
                    
                    pos_score = (user_vec * pos_item_vec).sum()
                    neg_score = (user_vec * neg_item_vec).sum()
                    
                    loss += -F.logsigmoid(pos_score - neg_score)
                
                loss = loss / num_samples
            
            elif self.model_type == 'graphsage':
                embeddings = self.model(self.node_features, self.edge_index)
                
                # Similar BPR loss
                loss = 0
                num_samples = min(batch_size, len(interactions))
                
                for _ in range(num_samples):
                    interaction = interactions[np.random.randint(len(interactions))]
                    user_idx = self.user_id_map[interaction['user_id']]
                    pos_item_idx = self.item_id_map[interaction['item_id']] + len(self.user_id_map)
                    neg_item_idx = np.random.randint(len(self.item_id_map)) + len(self.user_id_map)
                    
                    user_vec = embeddings[user_idx]
                    pos_item_vec = embeddings[pos_item_idx]
                    neg_item_vec = embeddings[neg_item_idx]
                    
                    pos_score = (user_vec * pos_item_vec).sum()
                    neg_score = (user_vec * neg_item_vec).sum()
                    
                    loss += -F.logsigmoid(pos_score - neg_score)
                
                loss = loss / num_samples
            
            if hasattr(loss, 'backward'):
                loss.backward()
            optimizer.step()
            
            if (epoch + 1) % 10 == 0:
                loss_val = loss.item() if hasattr(loss, 'item') else float(loss)
                logger.info(f"Epoch {epoch + 1}/{epochs}, Loss: {loss_val:.4f}")
        
        self.is_trained = True
        logger.info("Training complete")
    
    def recommend_items(self, user_id: str, item_candidates: List[str], 
                       top_k: int = 10) -> List[Tuple[str, float]]:
        """
        Recommend items for a user using GNN
        
        Args:
            user_id: User identifier
            item_candidates: List of candidate item IDs
            top_k: Number of recommendations
        
        Returns:
            List of (item_id, score) tuples
        """
        if not self.is_trained or not TORCH_AVAILABLE:
            logger.warning("GNN model not trained or PyTorch unavailable")
            return []
        
        if user_id not in self.user_id_map:
            logger.debug(f"User {user_id} not in graph (cold start)")
            return []
        
        if self.model:
            self.model.eval()
        
        with torch.no_grad():
            if self.model_type == 'lightgcn' and self.model:
                user_emb, item_emb = self.model(self.edge_index)
                user_idx = self.user_id_map[user_id]
                user_vec = user_emb[user_idx]
                
                scores = []
                for item_id in item_candidates:
                    if item_id in self.item_id_map:
                        item_idx = self.item_id_map[item_id]
                        item_vec = item_emb[item_idx]
                        score = (user_vec * item_vec).sum().item()
                        scores.append((item_id, score))
            
            elif self.model_type == 'graphsage' and self.model:
                embeddings = self.model(self.node_features, self.edge_index)
                user_idx = self.user_id_map[user_id]
                user_vec = embeddings[user_idx]
                
                scores = []
                for item_id in item_candidates:
                    if item_id in self.item_id_map:
                        item_idx = self.item_id_map[item_id] + len(self.user_id_map)
                        item_vec = embeddings[item_idx]
                        score = (user_vec * item_vec).sum().item()
                        scores.append((item_id, score))
            else:
                scores = []
        
        # Sort by score
        scores.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Generated {len(scores)} GNN recommendations for user {user_id}")
        
        return scores[:top_k]
    
    def save_model(self, path: str):
        """Save model to disk"""
        if TORCH_AVAILABLE and self.model:
            torch.save({
                'model_state': self.model.state_dict(),
                'user_id_map': self.user_id_map,
                'item_id_map': self.item_id_map,
                'config': {
                    'model_type': self.model_type,
                    'embedding_dim': self.embedding_dim,
                    'num_layers': self.num_layers
                }
            }, path)
            logger.info(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """Load model from disk"""
        if TORCH_AVAILABLE:
            checkpoint = torch.load(path, map_location=self.device)  # type: ignore
            self.user_id_map = checkpoint['user_id_map']
            self.item_id_map = checkpoint['item_id_map']
            
            # Rebuild model
            config = checkpoint['config']
            num_users = len(self.user_id_map)
            num_items = len(self.item_id_map)
            
            if config['model_type'] == 'lightgcn':
                self.model = LightGCN(num_users, num_items, 
                                     config['embedding_dim'], config['num_layers'])
            
            if self.model:
                self.model.load_state_dict(checkpoint['model_state'])
                self.model = self.model.to(self.device)
            self.is_trained = True
            logger.info(f"Model loaded from {path}")
