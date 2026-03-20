const express = require('express');
const router = express.Router();
const combinedAuthMiddleware = require('../middleware/combinedAuthMiddleware');
const {
  normalizePlan,
  normalizeBillingCycle,
  normalizeStatus,
  getSubscriptionForResponse,
  hasFeature
} = require('../config/subscriptionFeatures');

router.use(combinedAuthMiddleware);

router.get('/subscription/my', async (req, res) => {
  try {
    const subscription = req.user.subscription || {};
    return res.json({
      success: true,
      subscription: getSubscriptionForResponse(subscription),
      userType: req.userType || 'user'
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

router.put('/subscription/select', async (req, res) => {
  try {
    const { plan, billingCycle, status } = req.body;

    const current = req.user.subscription || {};
    const normalized = {
      plan: normalizePlan(plan || current.plan),
      billingCycle: normalizeBillingCycle(billingCycle || current.billingCycle),
      status: normalizeStatus(status || current.status),
      startedAt: current.startedAt || new Date(),
      updatedAt: new Date()
    };

    req.user.subscription = normalized;
    await req.user.save();

    return res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: getSubscriptionForResponse(req.user.subscription),
      userType: req.userType || 'user'
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

router.get('/subscription/feature-access/:featureKey', async (req, res) => {
  try {
    const { featureKey } = req.params;
    const subscription = req.user.subscription || {};
    const normalizedSubscription = getSubscriptionForResponse(subscription);
    const allowed = hasFeature(subscription, featureKey);

    return res.json({
      success: true,
      allowed,
      feature: featureKey,
      subscription: normalizedSubscription,
      userType: req.userType || 'user'
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    return res.status(500).json({ success: false, error: 'Failed to check feature access' });
  }
});

module.exports = router;
