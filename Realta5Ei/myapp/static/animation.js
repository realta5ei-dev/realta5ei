document.addEventListener('DOMContentLoaded', function() {
    initNavbar();
    initImageModal();
    initCardClick();
    initParallax();
    initCursorEffect();
    initSmoothScroll();
    initLazyLoad();
    loadGlossary();
    initFadeInObserver();
    initStatCounters();
});

function initNavbar() {
    let lastScroll = 0;
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentScroll = window.pageYOffset;
                if (currentScroll > 120) {
                    if (currentScroll > lastScroll && currentScroll > 200) {
                        navbar.classList.add('hidden');
                    } else {
                        navbar.classList.remove('hidden');
                    }
                } else {
                    navbar.classList.remove('hidden');
                }
                lastScroll = currentScroll;
                ticking = false;
            });
            ticking = true;
        }
    });
}

function initImageModal() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const images = document.querySelectorAll('.image-container');
    if (!modal || !modalImg) return;
    images.forEach(container => {
        container.addEventListener('click', (e) => {
            e.preventDefault();
            const img = container.querySelector('img');
            if (img) {
                modal.classList.add('active');
                modalImg.src = img.src;
                document.body.style.overflow = 'hidden';
                setTimeout(() => {
                    modalImg.style.transform = 'scale(1)';
                }, 10);
            }
        });
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-close')) {
            modalImg.style.transform = 'scale(0.8)';
            setTimeout(() => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }, 300);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modalImg.style.transform = 'scale(0.8)';
            setTimeout(() => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }, 300);
        }
    });
}

function initCardClick() {
    const cards = document.querySelectorAll('.article-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-link') &&
                !e.target.closest('.reaction-btn') &&
                !e.target.closest('.card-stats')) {
                const link = card.querySelector('.card-link');
                if (link) {
                    window.location.href = link.href;
                }
            }
        });
    });
}

function updateTransform(el) {
    const ty = el.dataset.parallaxY || '0px';
    const rx = el.dataset.rotateX || '0';
    const ry = el.dataset.rotateY || '0';
    el.style.transform = `translateY(${ty}) perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
}

function initParallax() {
    const parallaxElements = document.querySelectorAll('.intro-card, .quote-card, .hero-content');
    if (!parallaxElements.length) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                parallaxElements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const elementTop = rect.top + window.pageYOffset;
                    const elementHeight = rect.height;
                    const viewportHeight = window.innerHeight;
                    if (scrolled + viewportHeight > elementTop && scrolled < elementTop + elementHeight) {
                        const speed = el.classList.contains('hero-content') ? 0.15 : 0.25;
                        const yPos = -((scrolled - elementTop) * speed);
                        el.dataset.parallaxY = `${yPos}px`;
                        updateTransform(el);
                    } else {
                        el.dataset.parallaxY = '0px';
                        updateTransform(el);
                    }
                });
                ticking = false;
            });
            ticking = true;
        }
    });
}

function initCursorEffect() {
    const cards = document.querySelectorAll('.article-card, .slide-card, .search-card');
    if (!cards.length) return;
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * 3;
            const rotateY = ((centerX - x) / centerX) * 3;
            card.dataset.rotateX = `${rotateX}`;
            card.dataset.rotateY = `${rotateY}`;
            updateTransform(card);
        });
        card.addEventListener('mouseleave', () => {
            card.dataset.rotateX = '0';
            card.dataset.rotateY = '0';
            updateTransform(card);
        });
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 100;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initLazyLoad() {
    const images = document.querySelectorAll('img[data-src]');
    if (!images.length) return;
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px'
    });
    images.forEach(img => imageObserver.observe(img));
}

function initFadeInObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    const fadeInObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                fadeInObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    document.querySelectorAll('.stat-box, .glossary-item, .timeline-item').forEach(el => {
        fadeInObserver.observe(el);
    });
}

let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
function animateCursor() {
    const diffX = mouseX - cursorX;
    const diffY = mouseY - cursorY;
    cursorX += diffX * 0.1;
    cursorY += diffY * 0.1;
    requestAnimationFrame(animateCursor);
}
animateCursor();

async function safeFetchJSON(url, options = {}) {
    if (typeof fetchJSON === 'function') {
        try { return await fetchJSON(url, options); } catch (e) { return { error: true, message: e.message }; }
    }
    try {
        const res = await fetch(url, options);
        const contentType = res.headers.get('Content-Type') || '';
        if (!res.ok) return { error: true, status: res.status, statusText: res.statusText };
        if (contentType.includes('application/json')) return await res.json();
        return null;
    } catch (err) {
        return { error: true, network: true, message: err.message };
    }
}





function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function initFilters() {
    const filterButtons = document.getElementById('filterButtons');
    if (!filterButtons) return;
    const existingAll = filterButtons.querySelector('.filter-btn[data-filter="all"]');
    if (existingAll) existingAll.setAttribute('type', 'button');
    const articles = document.querySelectorAll('.article-card');
    const groups = new Set();
    articles.forEach(article => {
        const raw = article.dataset.group;
        if (raw) groups.add(raw.trim());
    });
    groups.forEach(group => {
        if (!filterButtons.querySelector(`.filter-btn[data-filter="${cssEscapeAttr(group)}"]`)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-btn';
            btn.dataset.filter = group;
            btn.textContent = group;
            btn.addEventListener('click', (e) => filterArticles(group, e.currentTarget));
            filterButtons.appendChild(btn);
        }
    });
    const allBtn = filterButtons.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', (e) => filterArticles('all', e.currentTarget));
        if (!filterButtons.querySelector('.filter-btn.active')) allBtn.classList.add('active');
    }
    filterButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        const group = btn.dataset.filter || 'all';
        filterArticles(group, btn);
    });
}

function filterArticles(group, clickedButton) {
    const articles = document.querySelectorAll('.article-card');
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (clickedButton) clickedButton.classList.add('active');
    else {
        const fallback = document.querySelector(`.filter-btn[data-filter="${cssEscapeAttr(group)}"]`);
        if (fallback) fallback.classList.add('active');
    }
    articles.forEach(article => {
        const g = (article.dataset.group || '').trim();
        if (group === 'all' || g === group) {
            article.style.display = '';
            setTimeout(() => article.classList.add('visible'), 20);
        } else {
            article.classList.remove('visible');
            setTimeout(() => {
                article.style.display = 'none';
            }, 300);
        }
    });
}

function cssEscapeAttr(s) {
    if (!s) return '';
    return s.replace(/(["'\\])/g, '\\$1');
}

function animateCounter(element, target) {
    const parsed = Number(target);
    if (!isFinite(parsed) || parsed <= 0) {
        element.textContent = (isFinite(parsed) ? parsed : element.textContent);
        return;
    }
    const duration = 1200;
    const startTime = performance.now();
    const startValue = 0;
    const endValue = Math.floor(parsed);
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        const current = Math.floor(startValue + (endValue - startValue) * eased);
        element.textContent = current.toString();
        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            element.textContent = endValue.toString();
        }
    }
    requestAnimationFrame(frame);
}

function initStatCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');
    if (!counters.length) return;
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const raw = entry.target.dataset.target;
                const targetNum = Number(raw);
                if (isFinite(targetNum) && targetNum > 0) {
                    animateCounter(entry.target, targetNum);
                } else {
                    entry.target.textContent = entry.target.textContent || raw;
                }
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });
    counters.forEach(counter => observer.observe(counter));
}
