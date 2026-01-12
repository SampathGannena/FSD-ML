"""
Graph Builder for GNN Recommender
Constructs graph structures from user interactions
"""

from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class GraphBuilder:
    """
    Builds heterogeneous graphs for GNN-based recommendations
    """
    
    def __init__(self):
        self.nodes = {
            'users': set(),
            'mentors': set(),
            'sessions': set(),
            'groups': set()
        }
        self.edges = []
        self.node_features = {}
    
    def add_user_mentor_edges(self, mentorship_requests: List[Dict]):
        """
        Add edges between users and mentors
        
        Args:
            mentorship_requests: List of MentorshipRequest documents
        """
        for request in mentorship_requests:
            user_id = str(request.get('learnerId'))
            mentor_id = str(request.get('mentorId'))
            status = request.get('status')
            
            self.nodes['users'].add(user_id)
            self.nodes['mentors'].add(mentor_id)
            
            # Only add edges for accepted mentorships
            if status == 'accepted':
                self.edges.append({
                    'source': user_id,
                    'target': mentor_id,
                    'edge_type': 'mentored_by',
                    'weight': 1.0
                })
        
        logger.info(f"Added {len(self.edges)} user-mentor edges")
    
    def add_user_session_edges(self, study_sessions: List[Dict]):
        """
        Add edges between users and study sessions
        
        Args:
            study_sessions: List of StudySession documents
        """
        edge_count = 0
        
        for session in study_sessions:
            session_id = str(session.get('_id'))
            participants = session.get('participants', [])
            
            self.nodes['sessions'].add(session_id)
            
            for participant in participants:
                user_id = str(participant.get('userId'))
                status = participant.get('status', 'registered')
                
                self.nodes['users'].add(user_id)
                
                # Add edge if participated
                if status in ['completed', 'attended', 'registered']:
                    weight = 1.0 if status == 'completed' else 0.7
                    
                    self.edges.append({
                        'source': user_id,
                        'target': session_id,
                        'edge_type': 'attended',
                        'weight': weight
                    })
                    edge_count += 1
        
        logger.info(f"Added {edge_count} user-session edges")
    
    def add_user_group_edges(self, groups: List[Dict]):
        """
        Add edges between users and groups, and between group members
        
        Args:
            groups: List of Group documents
        """
        edge_count = 0
        
        for group in groups:
            group_id = str(group.get('_id'))
            members = group.get('members', [])
            
            self.nodes['groups'].add(group_id)
            
            member_ids = []
            for member in members:
                user_id = str(member.get('userId'))
                self.nodes['users'].add(user_id)
                member_ids.append(user_id)
                
                # User-to-group edge
                self.edges.append({
                    'source': user_id,
                    'target': group_id,
                    'edge_type': 'member_of',
                    'weight': 1.0
                })
                edge_count += 1
            
            # User-to-user edges within group (co-membership)
            for i, user_id_1 in enumerate(member_ids):
                for user_id_2 in member_ids[i+1:]:
                    self.edges.append({
                        'source': user_id_1,
                        'target': user_id_2,
                        'edge_type': 'group_peer',
                        'weight': 0.5
                    })
                    edge_count += 1
        
        logger.info(f"Added {edge_count} group-related edges")
    
    def add_session_organizer_edges(self, study_sessions: List[Dict]):
        """
        Add edges between sessions and their organizers
        
        Args:
            study_sessions: List of StudySession documents
        """
        edge_count = 0
        
        for session in study_sessions:
            session_id = str(session.get('_id'))
            organizer_id = str(session.get('organizer'))
            
            self.nodes['sessions'].add(session_id)
            self.nodes['users'].add(organizer_id)
            
            self.edges.append({
                'source': organizer_id,
                'target': session_id,
                'edge_type': 'organizes',
                'weight': 1.5
            })
            edge_count += 1
        
        logger.info(f"Added {edge_count} organizer edges")
    
    def add_node_features(self, node_id: str, node_type: str, features: Dict):
        """
        Add feature vector for a node
        
        Args:
            node_id: Node identifier
            node_type: Type of node (user, mentor, session, group)
            features: Feature dictionary
        """
        self.node_features[node_id] = {
            'type': node_type,
            'features': features
        }
    
    def get_graph_data(self) -> Dict:
        """
        Get complete graph data structure
        
        Returns:
            Dictionary with nodes, edges, and features
        """
        total_nodes = sum(len(nodes) for nodes in self.nodes.values())
        
        graph_data = {
            'nodes': self.nodes,
            'edges': self.edges,
            'node_features': self.node_features,
            'stats': {
                'total_nodes': total_nodes,
                'total_edges': len(self.edges),
                'num_users': len(self.nodes['users']),
                'num_mentors': len(self.nodes['mentors']),
                'num_sessions': len(self.nodes['sessions']),
                'num_groups': len(self.nodes['groups'])
            }
        }
        
        logger.info(f"Graph constructed: {total_nodes} nodes, {len(self.edges)} edges")
        return graph_data
    
    def get_bipartite_graph(self, node_type_1: str, node_type_2: str) -> Tuple[List, List, List]:
        """
        Extract bipartite graph between two node types
        
        Args:
            node_type_1: First node type (e.g., 'users')
            node_type_2: Second node type (e.g., 'mentors')
        
        Returns:
            Tuple of (node_list_1, node_list_2, edges)
        """
        nodes_1 = list(self.nodes[node_type_1])
        nodes_2 = list(self.nodes[node_type_2])
        
        # Filter edges between these node types
        bipartite_edges = []
        for edge in self.edges:
            if edge['source'] in nodes_1 and edge['target'] in nodes_2:
                bipartite_edges.append(edge)
            elif edge['source'] in nodes_2 and edge['target'] in nodes_1:
                bipartite_edges.append(edge)
        
        logger.info(f"Extracted bipartite graph: {len(nodes_1)} {node_type_1}, "
                   f"{len(nodes_2)} {node_type_2}, {len(bipartite_edges)} edges")
        
        return nodes_1, nodes_2, bipartite_edges


def build_graph_from_db(db_collections: Dict) -> GraphBuilder:
    """
    Build complete graph from MongoDB collections
    
    Args:
        db_collections: Dictionary with collection references
    
    Returns:
        GraphBuilder with complete graph
    """
    builder = GraphBuilder()
    
    # Add user-mentor edges
    if 'mentorship_requests' in db_collections:
        requests = list(db_collections['mentorship_requests'].find({}))
        builder.add_user_mentor_edges(requests)
    
    # Add user-session edges
    if 'study_sessions' in db_collections:
        sessions = list(db_collections['study_sessions'].find({}))
        builder.add_user_session_edges(sessions)
        builder.add_session_organizer_edges(sessions)
    
    # Add user-group edges
    if 'groups' in db_collections:
        groups = list(db_collections['groups'].find({}))
        builder.add_user_group_edges(groups)
    
    logger.info("Graph built from database")
    return builder
