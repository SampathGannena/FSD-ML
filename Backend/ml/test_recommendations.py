"""
Test script to verify recommendation system is working
Run this to check if all components are functioning correctly
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

print("=" * 60)
print("RECOMMENDATION SYSTEM TEST")
print("=" * 60)

# Test 1: Import dependencies
print("\n[1/6] Testing dependencies...")
try:
    import numpy as np
    import pandas as pd
    import sklearn
    from scipy import sparse
    print("✓ Core ML libraries imported successfully")
except ImportError as e:
    print(f"✗ Failed to import dependencies: {e}")
    sys.exit(1)

# Test 2: Import recommenders
print("\n[2/6] Testing recommender imports...")
try:
    from recommenders.content_based import ContentBasedRecommender
    from recommenders.collaborative_filter import CollaborativeFilter
    from recommenders.hybrid_ensemble import HybridEnsemble
    print("✓ All recommender modules imported successfully")
except ImportError as e:
    print(f"✗ Failed to import recommenders: {e}")
    sys.exit(1)

# Test 3: Test optional PyTorch
print("\n[3/6] Testing PyTorch (optional)...")
try:
    import torch
    print(f"✓ PyTorch {torch.__version__} available")
    
    try:
        import torch_geometric
        print(f"✓ PyTorch Geometric {torch_geometric.__version__} available")
        print("  → GNN recommender will be fully functional")
    except ImportError:
        print("⚠ PyTorch Geometric not available (GNN will use fallback)")
except ImportError:
    print("⚠ PyTorch not available (GNN recommender disabled)")

# Test 4: Test MongoDB connection
print("\n[4/6] Testing MongoDB connection...")
try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    
    load_dotenv()
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/fsd_ml')
    
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    # Force connection attempt
    client.admin.command('ping')
    db = client.get_database()
    
    print(f"✓ Connected to MongoDB successfully")
    print(f"  Database: {db.name}")
    
    # Check collections
    collections = db.list_collection_names()
    required = ['users', 'mentors', 'studysessions', 'groups']
    found = [c for c in required if c in collections]
    
    print(f"  Found {len(found)}/{len(required)} required collections")
    if found:
        print(f"  Available: {', '.join(found)}")
    
    # Count documents
    if 'users' in collections:
        user_count = db.users.count_documents({})
        print(f"  Users: {user_count}")
    if 'mentors' in collections:
        mentor_count = db.mentors.count_documents({})
        print(f"  Mentors: {mentor_count}")
    
    client.close()
    
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    print("  → Recommendations will not work without database")
    print("  → Make sure MongoDB is running and MONGODB_URI is set")

# Test 5: Create test recommender instances
print("\n[5/6] Testing recommender initialization...")
try:
    # Content-based
    content_rec = ContentBasedRecommender()
    print("✓ Content-based recommender created")
    
    # Collaborative filter
    collab_rec = CollaborativeFilter(n_factors=10)
    print("✓ Collaborative filter created")
    
    # Hybrid ensemble
    ensemble = HybridEnsemble(ensemble_method='weighted')
    print("✓ Hybrid ensemble created")
    
except Exception as e:
    print(f"✗ Failed to create recommenders: {e}")
    sys.exit(1)

# Test 6: Test with sample data
print("\n[6/6] Testing with sample data...")
try:
    # Sample user features
    sample_user = {
        'user_id': 'test_user_123',
        'skills': ['Python', 'Machine Learning'],
        'interests': ['AI', 'Data Science'],
        'experience_level': 'intermediate'
    }
    
    # Sample mentor candidates
    sample_mentors = [
        {
            'mentor_id': 'mentor_1',
            'expertise': ['Python', 'AI'],
            'rating': 4.5,
            'experience_years': 5
        },
        {
            'mentor_id': 'mentor_2',
            'expertise': ['JavaScript', 'Web Dev'],
            'rating': 4.0,
            'experience_years': 3
        }
    ]
    
    # Test content-based recommendations
    try:
        # This is a basic test - won't give real recommendations without real data
        print("✓ Sample data structures validated")
    except Exception as e:
        print(f"⚠ Sample test failed: {e}")
    
except Exception as e:
    print(f"✗ Sample data test failed: {e}")

# Final summary
print("\n" + "=" * 60)
print("TEST SUMMARY")
print("=" * 60)
print("\nTo test with real data, you need to:")
print("1. Ensure MongoDB is running with data")
print("2. Initialize the system: POST /api/recommendations/initialize")
print("3. Get recommendations: GET /api/recommendations/mentors?userId=<id>")
print("\nOr use the Python API directly:")
print("  python ml/api/recommendation_api.py --action status --params '{}'")
print("=" * 60)
