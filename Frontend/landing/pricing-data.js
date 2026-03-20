(function () {
    window.STUDYFINDER_PRICING = {
        currencySymbol: "₹",
        currencyCode: "INR",
        discountPercent: 20,
        plans: [
            {
                id: "starter",
                name: "Starter",
                badge: "Free",
                subtitle: "Best for new learners",
                monthly: 0,
                yearly: 0,
                features: [
                    "AI study group matching",
                    "Basic chat and messaging",
                    "Task management",
                    "Up to 5 group members",
                    "1GB cloud storage"
                ]
            },
            {
                id: "premium",
                name: "Premium",
                badge: "Most Popular",
                badgeClass: "popular",
                subtitle: "Ideal for active learners",
                monthly: 799,
                yearly: 7670,
                featured: true,
                features: [
                    "Everything in Starter",
                    "HD video conferencing",
                    "Mentorship access",
                    "Progress analytics",
                    "Unlimited group members",
                    "50GB cloud storage",
                    "Priority support"
                ]
            },
            {
                id: "enterprise",
                name: "Enterprise",
                badge: "Pro",
                subtitle: "For institutions and teams",
                monthly: 2399,
                yearly: 23030,
                features: [
                    "Everything in Premium",
                    "Collaborative code editor and whiteboard",
                    "Advanced calendar and scheduling",
                    "Custom branding",
                    "API access",
                    "Unlimited storage",
                    "Dedicated support"
                ]
            }
        ]
    };
})();
