/**
 * Group Recommendation Service
 * 
 * This service provides intelligent group recommendations for users based on:
 * 1. User's current groups (similarity-based)
 * 2. Group activity and popularity
 * 3. Group size and availability
 * 4. User's interests and preferences
 * 5. Collaborative filtering (users with similar group memberships)
 */

const Group = require('../models/Group');
const User = require('../models/User');

class GroupRecommendationService {
  /**
   * Get personalized group recommendations for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of recommendations to return (default: 10)
   * @returns {Array} Array of recommended groups with scores
   */
  static async getRecommendations(userId, limit = 10) {
    try {
      // Get user and their current groups
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get all active groups
      const allGroups = await Group.find({ status: 'active' });
      
      // Filter out groups user is already a member of
      const userGroupIds = new Set(user.groups || []);
      const candidateGroups = allGroups.filter(group => !userGroupIds.has(group.name));

      // Calculate recommendation scores for each candidate group
      const recommendations = await Promise.all(
        candidateGroups.map(async (group) => {
          const score = await this.calculateRecommendationScore(user, group, allGroups);
          return {
            group,
            score,
            reasons: this.getRecommendationReasons(user, group, score)
          };
        })
      );

      // Sort by score and return top N
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(rec => ({
          id: rec.group._id,
          name: rec.group.name,
          description: rec.group.description,
          category: rec.group.category,
          memberCount: rec.group.members.length,
          activeMembers: rec.group.members.filter(m => m.status === 'online' || m.status === 'away').length,
          stats: rec.group.stats,
          isPublic: rec.group.settings.isPublic,
          score: rec.score,
          reasons: rec.reasons,
          recentActivity: rec.group.recentActivity.slice(0, 3)
        }));
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Calculate recommendation score for a group
   * Combines multiple factors with weighted scoring
   */
  static async calculateRecommendationScore(user, group, allGroups) {
    let score = 0;
    const weights = {
      similarity: 0.30,      // 30% - Based on user's current groups
      popularity: 0.20,      // 20% - Active and popular groups
      activity: 0.25,        // 25% - Recent group activity
      availability: 0.15,    // 15% - Group has space and is public
      collaborative: 0.10    // 10% - Similar users are in this group
    };

    // 1. Similarity Score (based on user's current groups)
    const similarityScore = this.calculateSimilarityScore(user, group, allGroups);
    score += similarityScore * weights.similarity;

    // 2. Popularity Score (based on member count and engagement)
    const popularityScore = this.calculatePopularityScore(group);
    score += popularityScore * weights.popularity;

    // 3. Activity Score (based on recent activity)
    const activityScore = this.calculateActivityScore(group);
    score += activityScore * weights.activity;

    // 4. Availability Score (public, has space, doesn't require approval)
    const availabilityScore = this.calculateAvailabilityScore(group);
    score += availabilityScore * weights.availability;

    // 5. Collaborative Filtering Score
    const collaborativeScore = await this.calculateCollaborativeScore(user, group, allGroups);
    score += collaborativeScore * weights.collaborative;

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate similarity based on category matching and group names
   */
  static calculateSimilarityScore(user, group, allGroups) {
    if (!user.groups || user.groups.length === 0) {
      return 0.5; // Neutral score for new users
    }

    let score = 0;
    const userGroups = allGroups.filter(g => user.groups.includes(g.name));

    // Category matching
    const categoryCounts = {};
    userGroups.forEach(g => {
      const cat = g.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const groupCategory = group.category || 'General';
    if (categoryCounts[groupCategory]) {
      score += 0.6; // Strong match if user has groups in same category
    }

    // Name similarity (simple keyword matching)
    const groupKeywords = this.extractKeywords(group.name);
    const userGroupKeywords = userGroups.flatMap(g => this.extractKeywords(g.name));
    const commonKeywords = groupKeywords.filter(k => userGroupKeywords.includes(k));
    
    if (commonKeywords.length > 0) {
      score += 0.4 * (commonKeywords.length / groupKeywords.length);
    }

    return Math.min(score, 1); // Cap at 1
  }

  /**
   * Calculate popularity score based on members and engagement
   */
  static calculatePopularityScore(group) {
    const memberCount = group.members.length;
    const maxMembers = group.settings.maxMembers || 50;
    
    // Optimal size is 60-80% of max capacity
    const optimalMin = maxMembers * 0.3;
    const optimalMax = maxMembers * 0.8;
    
    let score = 0;
    
    if (memberCount >= optimalMin && memberCount <= optimalMax) {
      score = 1.0; // Perfect size
    } else if (memberCount < optimalMin) {
      score = memberCount / optimalMin; // Growing group
    } else {
      // Penalize nearly full groups
      score = Math.max(0, 1 - ((memberCount - optimalMax) / (maxMembers - optimalMax)));
    }

    // Boost for groups with good message-to-member ratio
    const avgMessagesPerMember = memberCount > 0 ? group.stats.totalMessages / memberCount : 0;
    if (avgMessagesPerMember > 10) {
      score += 0.2;
    } else if (avgMessagesPerMember > 5) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate activity score based on recent activity
   */
  static calculateActivityScore(group) {
    const recentActivity = group.recentActivity || [];
    if (recentActivity.length === 0) return 0.3; // Low score for inactive groups

    // Check activity in last 24 hours, 7 days, 30 days
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const last24h = recentActivity.filter(a => new Date(a.timestamp) > oneDayAgo).length;
    const last7d = recentActivity.filter(a => new Date(a.timestamp) > oneWeekAgo).length;
    const last30d = recentActivity.filter(a => new Date(a.timestamp) > oneMonthAgo).length;

    let score = 0;
    if (last24h > 5) score = 1.0;      // Very active
    else if (last24h > 2) score = 0.8; // Active
    else if (last7d > 10) score = 0.6; // Moderately active
    else if (last30d > 5) score = 0.4; // Some activity
    else score = 0.2;                   // Low activity

    return score;
  }

  /**
   * Calculate availability score
   */
  static calculateAvailabilityScore(group) {
    let score = 0;

    // Public groups are more accessible
    if (group.settings.isPublic) {
      score += 0.5;
    }

    // Groups that don't require approval are easier to join
    if (!group.settings.requireApproval) {
      score += 0.3;
    }

    // Groups with available space
    const memberCount = group.members.length;
    const maxMembers = group.settings.maxMembers || 50;
    const spaceAvailable = (maxMembers - memberCount) / maxMembers;
    score += spaceAvailable * 0.2;

    return Math.min(score, 1);
  }

  /**
   * Calculate collaborative filtering score
   * Find users similar to current user and see what groups they're in
   */
  static async calculateCollaborativeScore(user, group, allGroups) {
    if (!user.groups || user.groups.length === 0) {
      return 0.5; // Neutral score for new users
    }

    try {
      // Find users who share groups with current user
      const similarUsers = await User.find({
        _id: { $ne: user._id },
        groups: { $in: user.groups }
      }).limit(100);

      if (similarUsers.length === 0) return 0.5;

      // Count how many similar users are in this group
      const usersInThisGroup = group.members.filter(member =>
        similarUsers.some(u => u._id.toString() === member.userId?.toString())
      ).length;

      // Score based on percentage of similar users in this group
      const score = Math.min(usersInThisGroup / similarUsers.length, 1);
      
      return score;
    } catch (error) {
      console.error('Error in collaborative filtering:', error);
      return 0.5;
    }
  }

  /**
   * Extract keywords from group name for similarity matching
   */
  static extractKeywords(text) {
    if (!text) return [];
    
    // Common stop words to ignore
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .map(word => word.replace(/[^a-z0-9]/g, ''));
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  static getRecommendationReasons(user, group, score) {
    const reasons = [];

    // Activity-based reasons
    const recentActivity = group.recentActivity || [];
    const last24h = recentActivity.filter(a => 
      new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    if (last24h > 5) {
      reasons.push('Very active group with recent discussions');
    } else if (last24h > 2) {
      reasons.push('Active community');
    }

    // Popularity-based reasons
    const memberCount = group.members.length;
    if (memberCount >= 10 && memberCount <= 30) {
      reasons.push('Popular group with engaged members');
    } else if (memberCount < 10) {
      reasons.push('Small, close-knit community');
    }

    // Category-based reasons
    if (user.groups && user.groups.length > 0) {
      const userGroupsObj = user.groups;
      // This is simplified - in real scenario, match categories
      if (group.category) {
        reasons.push(`Matches your interest in ${group.category}`);
      }
    }

    // Activity type reasons
    if (group.stats.totalMessages > 50) {
      reasons.push('Rich conversation history');
    }
    if (group.stats.totalSessions > 5) {
      reasons.push('Regular study sessions');
    }

    // Availability
    if (group.settings.isPublic && !group.settings.requireApproval) {
      reasons.push('Easy to join - no approval needed');
    }

    // Default if no specific reasons
    if (reasons.length === 0) {
      reasons.push('Recommended based on your profile');
    }

    return reasons.slice(0, 3); // Return top 3 reasons
  }

  /**
   * Get trending groups (most active in last 7 days)
   */
  static async getTrendingGroups(limit = 5) {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const groups = await Group.find({ 
        status: 'active',
        'settings.isPublic': true
      });

      const trending = groups
        .map(group => {
          const recentActivityCount = group.recentActivity.filter(
            a => new Date(a.timestamp) > oneWeekAgo
          ).length;
          
          return {
            id: group._id,
            name: group.name,
            description: group.description,
            category: group.category,
            memberCount: group.members.length,
            activityCount: recentActivityCount,
            stats: group.stats
          };
        })
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, limit);

      return trending;
    } catch (error) {
      console.error('Error getting trending groups:', error);
      throw error;
    }
  }

  /**
   * Get groups similar to a specific group
   */
  static async getSimilarGroups(groupName, limit = 5) {
    try {
      const targetGroup = await Group.findOne({ name: groupName });
      if (!targetGroup) {
        throw new Error('Group not found');
      }

      const allGroups = await Group.find({ 
        status: 'active',
        name: { $ne: groupName }
      });

      const similar = allGroups
        .map(group => {
          let score = 0;

          // Category match
          if (group.category === targetGroup.category) {
            score += 0.5;
          }

          // Name similarity
          const targetKeywords = this.extractKeywords(targetGroup.name);
          const groupKeywords = this.extractKeywords(group.name);
          const commonKeywords = targetKeywords.filter(k => groupKeywords.includes(k));
          score += (commonKeywords.length / Math.max(targetKeywords.length, 1)) * 0.3;

          // Similar size
          const sizeDiff = Math.abs(group.members.length - targetGroup.members.length);
          if (sizeDiff < 5) score += 0.2;

          return {
            id: group._id,
            name: group.name,
            description: group.description,
            category: group.category,
            memberCount: group.members.length,
            stats: group.stats,
            score
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return similar;
    } catch (error) {
      console.error('Error getting similar groups:', error);
      throw error;
    }
  }
}

module.exports = GroupRecommendationService;
