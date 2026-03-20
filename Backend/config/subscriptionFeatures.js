const PLAN_FEATURES = {
  starter: [],
  premium: ['video_calls', 'file_sharing'],
  enterprise: ['video_calls', 'file_sharing', 'code_editor', 'whiteboard']
};

const DEFAULT_PLAN = 'starter';
const DEFAULT_BILLING = 'monthly';
const DEFAULT_STATUS = 'active';

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'string') {
    return DEFAULT_PLAN;
  }

  const normalized = plan.toLowerCase();
  return PLAN_FEATURES[normalized] ? normalized : DEFAULT_PLAN;
}

function normalizeBillingCycle(billingCycle) {
  if (billingCycle === 'yearly') {
    return 'yearly';
  }
  return DEFAULT_BILLING;
}

function normalizeStatus(status) {
  const allowed = ['active', 'trial', 'paused', 'cancelled'];
  if (allowed.includes(status)) {
    return status;
  }
  return DEFAULT_STATUS;
}

function normalizeSubscription(subscription = {}, options = {}) {
  const now = new Date();
  const plan = normalizePlan(subscription.plan);
  const touch = !!options.touch;

  return {
    plan,
    billingCycle: normalizeBillingCycle(subscription.billingCycle),
    status: normalizeStatus(subscription.status),
    startedAt: subscription.startedAt || now,
    updatedAt: touch ? now : (subscription.updatedAt || now)
  };
}

function getFeaturesForPlan(plan) {
  const normalizedPlan = normalizePlan(plan);
  return PLAN_FEATURES[normalizedPlan] || [];
}

function hasFeature(subscription = {}, featureKey) {
  const featureList = getFeaturesForPlan(subscription.plan);
  return featureList.includes(featureKey);
}

function getSubscriptionForResponse(subscription = {}) {
  const normalized = normalizeSubscription(subscription, { touch: false });
  return {
    plan: normalized.plan,
    billingCycle: normalized.billingCycle,
    status: normalized.status,
    startedAt: normalized.startedAt,
    updatedAt: normalized.updatedAt,
    features: getFeaturesForPlan(normalized.plan)
  };
}

module.exports = {
  PLAN_FEATURES,
  DEFAULT_PLAN,
  DEFAULT_BILLING,
  DEFAULT_STATUS,
  normalizePlan,
  normalizeBillingCycle,
  normalizeStatus,
  normalizeSubscription,
  getFeaturesForPlan,
  hasFeature,
  getSubscriptionForResponse
};
