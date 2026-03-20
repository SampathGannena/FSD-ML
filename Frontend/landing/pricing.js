document.addEventListener("DOMContentLoaded", function () {
    const updateNavState = () => {
        document.body.classList.toggle("nav-scrolled", window.scrollY > 24);
    };

    updateNavState();
    window.addEventListener("scroll", updateNavState, { passive: true });

    const params = new URLSearchParams(window.location.search);
    const explicitReturnTo = params.get("returnTo") || "";
    const activeRole = localStorage.getItem("activeAuthRole") || "";
    const hasUserToken = !!localStorage.getItem("token");
    const hasMentorToken = !!localStorage.getItem("mentorToken");

    let fallbackReturn = "land.html";
    let backLabel = "Back to Landing";

    if (activeRole === "mentor" || (!activeRole && hasMentorToken && !hasUserToken)) {
        fallbackReturn = "/mentorDash/mentorMain.html";
        backLabel = "Back to Mentor Dashboard";
    } else if (activeRole === "user" || activeRole === "learner" || (!activeRole && hasUserToken)) {
        fallbackReturn = "/Dashboards/main.html";
        backLabel = "Back to Dashboard";
    }

    const safeReturnTo = explicitReturnTo && explicitReturnTo.startsWith("/")
        ? explicitReturnTo
        : fallbackReturn;

    const navBack = document.getElementById("pricingBackNavLink");
    const actionBack = document.getElementById("pricingBackActionLink");

    if (navBack) {
        navBack.href = safeReturnTo;
        navBack.textContent = backLabel;
    }

    if (actionBack) {
        actionBack.href = safeReturnTo;
        const icon = actionBack.querySelector("i");
        actionBack.textContent = " " + backLabel;
        if (icon) {
            actionBack.prepend(icon);
        }
    }

    if (typeof window.initializeDynamicPricing === "function") {
        window.initializeDynamicPricing({
            rootSelector: '[data-pricing-scope="pricing-page"]',
            gridSelector: "#pricingPagePricingGrid",
            messageSelector: "#pricingPageUserMessage",
            defaultBilling: "monthly"
        });
    }

    document.querySelectorAll('a[href="#pricing"]').forEach((anchor) => {
        anchor.addEventListener("click", function (event) {
            const target = document.getElementById("pricing");
            if (!target) {
                return;
            }

            event.preventDefault();
            const offset = 94;
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: "smooth" });
        });
    });
});
