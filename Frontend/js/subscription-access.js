(function () {
  function getAuthToken() {
    return localStorage.getItem('token') || localStorage.getItem('mentorToken') || '';
  }

  function planDisplayName(plan) {
    if (plan === 'enterprise') return 'Enterprise';
    if (plan === 'premium') return 'Premium';
    return 'Starter';
  }

  function notifyError(message, title) {
    if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') {
      Toast.error(message, title || 'Feature Locked');
      return;
    }
    alert(message);
  }

  async function checkFeatureAccess(featureKey, token) {
    const authToken = token || getAuthToken();
    if (!authToken) {
      return {
        success: false,
        allowed: false,
        reason: 'AUTH_REQUIRED',
        error: 'Please sign in to continue.'
      };
    }

    const response = await fetch(`${window.location.origin}/api/subscription/feature-access/${encodeURIComponent(featureKey)}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        allowed: false,
        reason: response.status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED',
        error: text || `Request failed with status ${response.status}`
      };
    }

    return response.json();
  }

  async function ensureFeatureAccess(featureKey, options) {
    const config = options || {};
    const featureName = config.featureName || featureKey.replace(/_/g, ' ');
    const redirectTo = config.redirectTo || '';
    const token = config.token || getAuthToken();

    const result = await checkFeatureAccess(featureKey, token);

    if (result.success && result.allowed) {
      return result;
    }

    if (result.reason === 'AUTH_REQUIRED') {
      notifyError('Please sign in to use this feature.', 'Authentication Required');
      if (redirectTo) {
        window.location.href = redirectTo;
      }
      return result;
    }

    const currentPlan = result.subscription?.plan || 'starter';
    const currentPlanLabel = planDisplayName(currentPlan);
    notifyError(`${featureName} requires an upgraded plan. Current plan: ${currentPlanLabel}.`, 'Upgrade Required');

    if (redirectTo) {
      window.location.href = redirectTo;
    }

    return result;
  }

  window.SubscriptionAccess = {
    getAuthToken,
    checkFeatureAccess,
    ensureFeatureAccess
  };
})();
