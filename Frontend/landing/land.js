// Toggle navbar for mobile
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Smooth scrolling for navbar links
document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || !href.startsWith('#')) {
            return;
        }

        const target = document.querySelector(href);
        if (!target) {
            return;
        }

        e.preventDefault();
        window.scrollTo({
            top: target.offsetTop - 60,
            behavior: 'smooth'
        });

        navLinks?.classList.remove('active');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.initializeDynamicPricing === 'function') {
        window.initializeDynamicPricing({
            rootSelector: '[data-pricing-scope="landing"]',
            gridSelector: '#landingPricingGrid',
            messageSelector: '#pricingUserMessage',
            defaultBilling: 'monthly'
        });
    }
});
