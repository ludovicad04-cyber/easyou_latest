// Disabilita il ripristino automatico dello scroll al refresh
history.scrollRestoration = 'manual';

// Referral code dalla query string (es. ?referral_code=XXXXXX)
const incomingReferral = new URLSearchParams(window.location.search).get('referral_code');

// Custom cursor
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top = my + 'px';
});

function animRing() {
  rx += (mx - rx) * 0.13;
  ry += (my - ry) * 0.13;
  ring.style.left = rx + 'px';
  ring.style.top = ry + 'px';
  requestAnimationFrame(animRing);
}
animRing();

document.querySelectorAll('a, button, input').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.width = '18px';
    cursor.style.height = '18px';
    ring.style.width = '52px';
    ring.style.height = '52px';
  });

  el.addEventListener('mouseleave', () => {
    cursor.style.width = '10px';
    cursor.style.height = '10px';
    ring.style.width = '36px';
    ring.style.height = '36px';
  });
});

// Seamless cursor color switching based on pointer position within #waitlist.
const navEl = document.querySelector('nav');
const waitlistSection = document.getElementById('waitlist');

function getRefY() {
  const h = navEl ? navEl.getBoundingClientRect().height : 0;
  return Math.min(window.innerHeight - 1, Math.max(0, h + 6));
}

function isInWaitlist() {
  const waitlist = document.getElementById('waitlist');
  if (!waitlist) return false;

  const rect = waitlist.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const bottom = top + rect.height;

  const docY = window.scrollY + (lastPointerY ?? (window.innerHeight * 0.5));
  return docY >= top && docY < bottom;
}

let rafPending = false;
let lastPointerY = null;
let overOrangeEl = false;
let overDarkEl   = false;

function updateCursorColor() {
  rafPending = false;
  document.body.classList.toggle('cursor-black', overOrangeEl && !overDarkEl);
}

function scheduleUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(updateCursorColor);
}

window.addEventListener('mousemove', e => {
  lastPointerY = e.clientY;
  scheduleUpdate();
}, { passive: true });

window.addEventListener('scroll', scheduleUpdate, { passive: true });
window.addEventListener('resize', scheduleUpdate);
scheduleUpdate();

// Switch cursor to dark on any orange-background element
document.querySelectorAll('.btn-primary, .nav-cta, .hero-visual img, .hero-app-icon').forEach(el => {
  el.addEventListener('mouseenter', () => { overOrangeEl = true;  scheduleUpdate(); });
  el.addEventListener('mouseleave', () => { overOrangeEl = false; scheduleUpdate(); });
});

// Override back to orange on dark elements inside orange areas
document.querySelectorAll('.waitlist-form button').forEach(el => {
  el.addEventListener('mouseenter', () => { overDarkEl = true;  scheduleUpdate(); });
  el.addEventListener('mouseleave', () => { overDarkEl = false; scheduleUpdate(); });
});

// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 60);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item').forEach(i => {
      i.classList.remove('open');
      const question = i.querySelector('.faq-question');
      if (question) question.setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// Waitlist counter
let liveCount = null;

fetch('https://easyou-mvp-api-production.up.railway.app/api/waiting-list/count')
  .then(r => r.json())
  .then(d => { if (typeof d.count === 'number') liveCount = d.count; })
  .catch(() => {});

function getWaitlistCount() {
  if (liveCount !== null) return liveCount;
  // fallback simulato se l'API non risponde
  const WAITLIST_BASE_COUNT = 31;
  const WAITLIST_START_DATE = new Date('2026-02-20');
  const WAITLIST_DAILY_GROWTH = 9;
  const days = Math.max(0, Math.floor((Date.now() - WAITLIST_START_DATE) / 86400000));
  return WAITLIST_BASE_COUNT + days * WAITLIST_DAILY_GROWTH;
}

const waitlistCountEl = document.getElementById('waitlistCount');
if (waitlistCountEl) {
  const wObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = getWaitlistCount();
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        waitlistCountEl.textContent = Math.round(eased * target).toLocaleString('it-IT');
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      wObs.unobserve(waitlistCountEl);
    });
  }, { threshold: 0.5 });
  wObs.observe(waitlistCountEl);
}

// Waitlist form
document.getElementById('waitlistForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const toast = document.getElementById('toast');

  try {
    const body = { email };
    if (incomingReferral) body.referralCode = incomingReferral;

    const res = await fetch('https://easyou-mvp-api-production.up.railway.app/api/waiting-list/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('API status:', res.status);
    const data = await res.json().catch(() => null);
    console.log('API response:', data);

    showSignupModal(email, getWaitlistCount(), data?.referralCode);
    this.reset();
  } catch (err) {
    console.error('Fetch error:', err);
    // Show modal anyway — API issues shouldn't block the user flow
    showSignupModal(email, getWaitlistCount(), null);
    this.reset();
  }
});

// Signup success modal
function showSignupModal(email, position, referralCode) {
  document.getElementById('modal-email-val').textContent = email;
  const base = window.location.origin || 'https://easyouapp.com';
  const shareUrl = referralCode ? `${base}?referral_code=${referralCode}` : base;
  document.getElementById('modal-share-url').value = shareUrl;
  const codeEl = document.getElementById('modal-referral-code');
  const codeRow = document.getElementById('modal-code-row');
  if (referralCode) {
    codeEl.textContent = referralCode;
    codeRow.style.display = 'flex';
  } else {
    codeRow.style.display = 'none';
  }

  const posEl = document.getElementById('modal-pos-num');
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    posEl.textContent = Math.round(eased * position).toLocaleString('it-IT');
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.getElementById('signup-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSignupModal() {
  document.getElementById('signup-modal').classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('signup-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSignupModal();
});
document.querySelector('.modal-close').addEventListener('click', closeSignupModal);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSignupModal();
});
document.getElementById('modal-not-you').addEventListener('click', function(e) {
  e.preventDefault();
  closeSignupModal();
  setTimeout(() => {
    document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('email').focus(), 500);
  }, 50);
});

document.getElementById('modal-share-btn').addEventListener('click', function() {
  const url = document.getElementById('modal-share-url').value;
  if (navigator.share) {
    navigator.share({
      title: 'easyou — Semplice, per scelta.',
      text: "Hai mai pensato a un modo diverso di gestire i tuoi soldi? Easyou sta arrivando. Entra in lista d’attesa dal link:",
      url
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      this.textContent = '✓ Link copiato!';
      setTimeout(() => { this.textContent = 'Invitali tutti'; }, 2000);
    }).catch(() => {});
  }
});

// Nav border color on scroll
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.style.borderBottomColor = window.scrollY > 50 ? 'rgba(245,97,52,0.2)' : 'rgba(255,255,255,0.06)';
});

void waitlistSection;
void getRefY;

// Seamless background video loop via two alternating players
(function () {
  const a = document.querySelector('.value-video-bg');
  if (!a) return;

  // Clone to create the second player, hidden by default
  const b = a.cloneNode(true);
  b.style.opacity = '0';
  a.parentNode.insertBefore(b, a.nextSibling);
  b.load();

  const FADE_MS  = 600;   // crossfade duration
  const TRIGGER_S = 0.8;  // seconds before end to start the crossfade
  let cur = a, nxt = b, busy = false;

  setInterval(() => {
    if (busy || !cur.duration || !isFinite(cur.duration)) return;
    if (cur.currentTime < cur.duration - TRIGGER_S) return;

    busy = true;
    nxt.currentTime = 0;
    nxt.play().catch(() => {});
    nxt.style.transition = `opacity ${FADE_MS}ms ease`;
    nxt.style.opacity    = '0.18';
    cur.style.transition = `opacity ${FADE_MS}ms ease`;
    cur.style.opacity    = '0';

    setTimeout(() => {
      cur.pause();
      cur.style.transition = '';
      [cur, nxt] = [nxt, cur];   // swap roles
      nxt.style.transition = '';
      nxt.style.opacity    = '0';
      busy = false;
    }, FADE_MS + 100);
  }, 100);
}());

// Sticky phone: scroll-budget step switcher
// #how is a tall pin container (100vh + 600px); .how-pin is sticky at top: 0.
// Steps advance as the user scrolls through the 600px budget.
(function () {
  const section   = document.getElementById('how');
  if (!section) return;

  const stepItems = Array.from(section.querySelectorAll('.step-scroll-item'));
  const screens   = Array.from(section.querySelectorAll('.phone-screen[data-screen]'));
  const dots      = Array.from(document.querySelectorAll('.how-dot'));
  if (!stepItems.length || !screens.length) return;

  let activeIdx = -1;

  function activate(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;

    stepItems.forEach((el, i) => el.classList.toggle('step-active', i === idx));

    screens.forEach(s => s.classList.remove('phone-screen--active'));
    const target = section.querySelector(`.phone-screen[data-screen="${idx + 1}"]`);
    if (target) target.classList.add('phone-screen--active');

    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  activate(0);

  window.addEventListener('scroll', () => {
    if (window.innerWidth <= 760) return;
    const rect       = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const scrolled   = Math.max(0, -rect.top);
    const progress   = Math.min(1, scrolled / scrollable);
    const idx        = Math.min(stepItems.length - 1, Math.floor(progress * stepItems.length));
    activate(idx);
  }, { passive: true });
}());

// Wheel hijack: force one step per gesture inside #how
(function () {
  const section = document.getElementById('how');
  if (!section) return;

  const STEPS = 3;
  const ANIM_MS = 550;
  let currentStep = 0;
  let isAnimating = false;

  function sectionTop() {
    return section.getBoundingClientRect().top + window.scrollY;
  }

  function scrollable() {
    return section.offsetHeight - window.innerHeight;
  }

  function stepScrollTop(step) {
    // Each step occupies scrollable/STEPS px of budget
    return sectionTop() + scrollable() * step / STEPS;
  }

  function inStickyZone() {
    if (window.innerWidth <= 760) return false;
    const rect = section.getBoundingClientRect();
    return rect.top <= 1 && (-rect.top) < scrollable();
  }

  function goTo(step) {
    isAnimating = true;
    window.scrollTo({ top: stepScrollTop(step), behavior: 'smooth' });
    setTimeout(() => { isAnimating = false; }, ANIM_MS);
  }

  window.addEventListener('wheel', function (e) {
    if (window.innerWidth <= 760) return;
    if (!inStickyZone()) return;

    e.preventDefault();
    if (isAnimating) return;

    const dir = e.deltaY > 0 ? 1 : -1;
    const next = currentStep + dir;

    if (next < 0) {
      // Scroll up above section
      isAnimating = true;
      window.scrollTo({ top: sectionTop() - 10, behavior: 'smooth' });
      setTimeout(() => { isAnimating = false; }, ANIM_MS);
      return;
    }
    if (next >= STEPS) {
      // All steps done — release scroll past section
      isAnimating = true;
      window.scrollTo({ top: sectionTop() + scrollable() + 10, behavior: 'smooth' });
      setTimeout(() => { isAnimating = false; }, ANIM_MS);
      return;
    }

    currentStep = next;
    goTo(currentStep);
  }, { passive: false });

  // Keep currentStep in sync when scrolling via other means (keyboard, scrollbar)
  window.addEventListener('scroll', function () {
    if (isAnimating || window.innerWidth <= 760) return;
    const rect = section.getBoundingClientRect();
    const s = scrollable();
    if (s <= 0) return;
    const scrolled = Math.max(0, -rect.top);
    currentStep = Math.min(STEPS - 1, Math.floor(scrolled / s * STEPS));
  }, { passive: true });
}());

// Value counters: count up when section scrolls into view
const counterEls = document.querySelectorAll('.value-counter');
if (counterEls.length) {
  // Inizializza a zero: l'animazione parte solo quando l'utente arriva alla sezione
  counterEls.forEach(el => { el.textContent = '~€\u00a00'; });

  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const duration = 1600;
      const start = performance.now();

      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const val = Math.round(eased * target);
        el.textContent = '~€\u00a0' + val.toLocaleString('it-IT');
        if (t < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });

  counterEls.forEach(el => counterObs.observe(el));
}
