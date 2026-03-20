document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.initializeDynamicPricing === "function") {
        window.initializeDynamicPricing({
            rootSelector: '[data-pricing-scope="pricing-page"]',
            gridSelector: "#pricingPagePricingGrid",
            messageSelector: "#pricingPageUserMessage",
            defaultBilling: "monthly"
        });
    }
});
