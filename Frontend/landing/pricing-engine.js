(function () {
    const PLAN_STORAGE_KEY = "studyfinder.selectedPlan.v1";
    const BILLING_STORAGE_KEY = "studyfinder.billingPreference.v1";

    function toCurrencyAmount(amount, currencyCode) {
        const numeric = Number(amount);
        if (!Number.isFinite(numeric)) {
            return "0";
        }

        const isWhole = Number.isInteger(numeric);
        const locale = currencyCode === "INR" ? "en-IN" : "en-US";

        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: isWhole ? 0 : 2,
            maximumFractionDigits: isWhole ? 0 : 2
        }).format(numeric);
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function loadJson(key, fallbackValue) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) {
                return fallbackValue;
            }
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : fallbackValue;
        } catch (error) {
            console.warn("Unable to parse stored pricing state", error);
            return fallbackValue;
        }
    }

    function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getTokenIssuedAt(token) {
        try {
            const parts = String(token || "").split(".");
            if (parts.length < 2) {
                return 0;
            }
            const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
            return Number(payload.iat || 0);
        } catch (error) {
            return 0;
        }
    }

    async function fetchProfile(endpoint, token) {
        const response = await fetch(`${window.location.origin}${endpoint}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Profile request failed with status ${response.status}`);
        }

        return response.json();
    }

    async function resolveUserContext() {
        const activeRole = localStorage.getItem("activeAuthRole") || "";
        const learnerToken = localStorage.getItem("token");
        const mentorToken = localStorage.getItem("mentorToken");

        async function resolveLearner() {
            if (!learnerToken) {
                return null;
            }

            try {
                const profile = await fetchProfile("/api/profile", learnerToken);
                return {
                    role: "learner",
                    id: profile.userId || profile._id || localStorage.getItem("userId") || "learner",
                    name: profile.fullname || profile.name || "Learner",
                    token: learnerToken,
                    serverPlanId: profile.subscription?.plan || null,
                    serverBillingCycle: profile.subscription?.billingCycle || null
                };
            } catch (error) {
                console.warn("Learner profile check failed, falling back to local data", error);
                return {
                    role: "learner",
                    id: localStorage.getItem("userId") || "learner",
                    name: "Learner",
                    token: learnerToken
                };
            }
        }

        async function resolveMentor() {
            if (!mentorToken) {
                return null;
            }

            try {
                const profileData = await fetchProfile("/api/mentor/profile", mentorToken);
                const profile = profileData.profile || {};
                return {
                    role: "mentor",
                    id: profile.id || localStorage.getItem("mentorId") || "mentor",
                    name: profile.fullname || localStorage.getItem("mentorName") || "Mentor",
                    token: mentorToken,
                    serverPlanId: profile.subscription?.plan || null,
                    serverBillingCycle: profile.subscription?.billingCycle || null
                };
            } catch (error) {
                console.warn("Mentor profile check failed, falling back to local data", error);
                return {
                    role: "mentor",
                    id: localStorage.getItem("mentorId") || "mentor",
                    name: localStorage.getItem("mentorName") || "Mentor",
                    token: mentorToken
                };
            }
        }

        if (activeRole === "mentor") {
            const mentorContext = await resolveMentor();
            if (mentorContext) {
                return mentorContext;
            }

            const learnerContext = await resolveLearner();
            if (learnerContext) {
                return learnerContext;
            }
        } else {
            const preferMentor = !activeRole && learnerToken && mentorToken
                ? getTokenIssuedAt(mentorToken) > getTokenIssuedAt(learnerToken)
                : false;

            if (preferMentor) {
                const mentorContext = await resolveMentor();
                if (mentorContext) {
                    return mentorContext;
                }
            }

            const learnerContext = await resolveLearner();
            if (learnerContext) {
                return learnerContext;
            }

            const mentorContext = await resolveMentor();
            if (mentorContext) {
                return mentorContext;
            }
        }

        return {
            role: "guest",
            id: "guest",
            name: "Guest"
        };
    }

    function getUserStorageKey(userContext) {
        return `${userContext.role}:${userContext.id || "anon"}`;
    }

    function getDefaultPlanId(pricingData) {
        return pricingData.plans[0] ? pricingData.plans[0].id : "starter";
    }

    function getSelectedPlanId(userContext, pricingData) {
        const serverSelected = userContext.serverPlanId;
        const isValidServerPlan = pricingData.plans.some((plan) => plan.id === serverSelected);
        if (isValidServerPlan) {
            return serverSelected;
        }

        const planSelections = loadJson(PLAN_STORAGE_KEY, {});
        const selectedPlanId = planSelections[getUserStorageKey(userContext)]?.planId;
        const isValidPlan = pricingData.plans.some((plan) => plan.id === selectedPlanId);
        return isValidPlan ? selectedPlanId : getDefaultPlanId(pricingData);
    }

    function setSelectedPlanId(userContext, planId, billing) {
        const planSelections = loadJson(PLAN_STORAGE_KEY, {});
        planSelections[getUserStorageKey(userContext)] = {
            planId,
            billing,
            updatedAt: new Date().toISOString()
        };
        saveJson(PLAN_STORAGE_KEY, planSelections);
    }

    function getBillingPreference(defaultBilling) {
        const storedBilling = localStorage.getItem(BILLING_STORAGE_KEY);
        if (storedBilling === "monthly" || storedBilling === "yearly") {
            return storedBilling;
        }
        return defaultBilling;
    }

    function setBillingPreference(billing) {
        localStorage.setItem(BILLING_STORAGE_KEY, billing);
    }

    function getPriceForBilling(plan, billing, discountPercent) {
        if (billing === "yearly") {
            if (typeof plan.yearly === "number") {
                return plan.yearly;
            }
            return Number((plan.monthly * 12 * (1 - discountPercent / 100)).toFixed(2));
        }

        return plan.monthly;
    }

    function buildAction(plan, selectedPlanId, userContext, billing) {
        if (plan.id === selectedPlanId && userContext.role !== "guest") {
            return {
                label: "Current Plan",
                type: "current"
            };
        }

        if (userContext.role === "guest") {
            if (plan.monthly === 0) {
                return {
                    label: "Get Started Free",
                    type: "redirect",
                    href: "next.html"
                };
            }

            return {
                label: "Sign In to Choose",
                type: "redirect",
                href: "../credentials/signin.html"
            };
        }

        if (plan.monthly === 0) {
            return {
                label: "Switch to Starter",
                type: "select"
            };
        }

        const roleLabel = userContext.role === "mentor" ? "Activate" : "Choose";
        return {
            label: `${roleLabel} ${plan.name}${billing === "yearly" ? " Yearly" : ""}`,
            type: "select"
        };
    }

    function getFirstName(name) {
        const text = String(name || "").trim();
        if (!text) {
            return "there";
        }
        return text.split(" ")[0];
    }

    function showSuccessMessage(message) {
        if (typeof Toast !== "undefined" && typeof Toast.success === "function") {
            Toast.success(message, "Pricing Updated");
            return;
        }
        alert(message);
    }

    function showErrorMessage(message) {
        if (typeof Toast !== "undefined" && typeof Toast.error === "function") {
            Toast.error(message, "Pricing Update Failed");
            return;
        }
        alert(message);
    }

    async function savePlanToServer(userContext, planId, billing) {
        if (userContext.role === "guest" || !userContext.token) {
            return null;
        }

        const response = await fetch(`${window.location.origin}/api/subscription/select`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${userContext.token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                plan: planId,
                billingCycle: billing,
                status: "active"
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Subscription update failed: ${response.status}`);
        }

        return response.json();
    }

    function renderPricing({
        root,
        gridElement,
        messageElement,
        pricingData,
        userContext,
        billing,
        selectedPlanId
    }) {
        const discountPercent = pricingData.discountPercent || 20;
        const currencySymbol = pricingData.currencySymbol || "$";
        const currencyCode = pricingData.currencyCode || "USD";

        const cards = pricingData.plans.map((plan) => {
            const price = getPriceForBilling(plan, billing, discountPercent);
            const action = buildAction(plan, selectedPlanId, userContext, billing);
            const isCurrent = userContext.role !== "guest" && plan.id === selectedPlanId;
            const badgeClass = plan.badgeClass ? ` ${escapeHtml(plan.badgeClass)}` : "";
            const cardClasses = ["pricing-card"];
            if (plan.featured) {
                cardClasses.push("featured");
            }
            if (isCurrent) {
                cardClasses.push("is-current");
            }

            const yearlyNote = billing === "yearly" && price > 0
                ? `<div class="price-note">Billed yearly at ${escapeHtml(currencySymbol)}${toCurrencyAmount(price, currencyCode)}</div>`
                : "";

            const periodLabel = billing === "yearly" ? "/year" : "/month";

            const featureItems = plan.features
                .map((feature) => `<li><i class="fas fa-check"></i> ${escapeHtml(feature)}</li>`)
                .join("");

            return `
                <article class="${cardClasses.join(" ")}" data-plan-card="${escapeHtml(plan.id)}">
                    <div class="plan-badge${badgeClass}">${escapeHtml(plan.badge || "Plan")}</div>
                    <h3>${escapeHtml(plan.name)}</h3>
                    <p class="plan-meta">${escapeHtml(plan.subtitle || "")}</p>
                    <div class="price">
                        <span class="currency">${escapeHtml(currencySymbol)}</span>
                        <span class="amount">${toCurrencyAmount(price, currencyCode)}</span>
                        <span class="period">${periodLabel}</span>
                        ${yearlyNote}
                    </div>
                    <ul class="features-list">
                        ${featureItems}
                    </ul>
                    <button
                        type="button"
                        class="plan-btn ${action.type === "current" ? "current" : ""}"
                        data-plan-id="${escapeHtml(plan.id)}"
                        data-action="${escapeHtml(action.type)}"
                        data-action-href="${escapeHtml(action.href || "")}">
                        ${escapeHtml(action.label)}
                    </button>
                </article>
            `;
        });

        gridElement.innerHTML = cards.join("");

        if (messageElement) {
            const activePlan = pricingData.plans.find((plan) => plan.id === selectedPlanId) || pricingData.plans[0];
            if (userContext.role === "guest") {
                messageElement.textContent = "Sign in to save your plan. Guest users can instantly start with Starter.";
            } else {
                messageElement.textContent = `Hi ${getFirstName(userContext.name)}, your active plan is ${activePlan.name}.`;
            }
        }

        root.querySelectorAll(".billing-btn").forEach((button) => {
            button.classList.toggle("active", button.dataset.billing === billing);
        });
    }

    window.initializeDynamicPricing = async function initializeDynamicPricing(options = {}) {
        const root = options.rootElement || document.querySelector(options.rootSelector || "[data-pricing-scope]");
        if (!root) {
            return;
        }

        const gridElement = root.querySelector(options.gridSelector || ".pricing-grid");
        if (!gridElement) {
            return;
        }

        const pricingData = window.STUDYFINDER_PRICING;
        if (!pricingData || !Array.isArray(pricingData.plans) || pricingData.plans.length === 0) {
            gridElement.innerHTML = "<p class=\"pricing-empty\">Pricing is not available right now.</p>";
            return;
        }

        const messageElement = root.querySelector(options.messageSelector || ".pricing-user-message");
        const userContext = await resolveUserContext();
        let billing = getBillingPreference(options.defaultBilling || "monthly");
        if (userContext.serverBillingCycle === "monthly" || userContext.serverBillingCycle === "yearly") {
            billing = userContext.serverBillingCycle;
        }
        let selectedPlanId = getSelectedPlanId(userContext, pricingData);

        renderPricing({
            root,
            gridElement,
            messageElement,
            pricingData,
            userContext,
            billing,
            selectedPlanId
        });

        root.addEventListener("click", async (event) => {
            const toggleButton = event.target.closest(".billing-btn");
            if (toggleButton) {
                const newBilling = toggleButton.dataset.billing;
                if (newBilling === "monthly" || newBilling === "yearly") {
                    billing = newBilling;
                    setBillingPreference(newBilling);
                    renderPricing({
                        root,
                        gridElement,
                        messageElement,
                        pricingData,
                        userContext,
                        billing,
                        selectedPlanId
                    });
                }
                return;
            }

            const planButton = event.target.closest(".plan-btn");
            if (!planButton) {
                return;
            }

            const action = planButton.dataset.action;
            const planId = planButton.dataset.planId;

            if (action === "current") {
                return;
            }

            if (action === "redirect") {
                const href = planButton.dataset.actionHref;
                if (href) {
                    window.location.href = href;
                }
                return;
            }

            if (action === "select") {
                const previousPlanId = selectedPlanId;
                try {
                    selectedPlanId = planId;
                    setSelectedPlanId(userContext, selectedPlanId, billing);

                    const serverResponse = await savePlanToServer(userContext, selectedPlanId, billing);
                    if (serverResponse?.subscription?.plan) {
                        selectedPlanId = serverResponse.subscription.plan;
                    }

                    const selectedPlan = pricingData.plans.find((plan) => plan.id === selectedPlanId);
                    if (selectedPlan) {
                        showSuccessMessage(`${selectedPlan.name} plan selected (${billing}).`);
                    }
                } catch (error) {
                    console.error("Failed to save subscription on server:", error);
                    selectedPlanId = previousPlanId;
                    setSelectedPlanId(userContext, selectedPlanId, billing);
                    showErrorMessage("Plan was saved locally, but server update failed.");
                }

                renderPricing({
                    root,
                    gridElement,
                    messageElement,
                    pricingData,
                    userContext,
                    billing,
                    selectedPlanId
                });
            }
        });
    };
})();
