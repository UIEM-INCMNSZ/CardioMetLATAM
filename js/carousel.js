/* ============================================================
   CARDIOMET-LATAM · Hero carousel
   Auto-advancing slide carousel with dot navigation and swipe.
   ============================================================ */

(function () {
  'use strict';

  const carousel = document.querySelector('.carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.carousel__slide'));
  const dotsContainer = carousel.querySelector('.carousel__dots');
  const prevBtn = carousel.querySelector('.carousel__arrow--prev');
  const nextBtn = carousel.querySelector('.carousel__arrow--next');

  let current = 0;
  let autoTimer = null;
  const INTERVAL_MS = 6000;

  // Build dots
  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'carousel__dot';
    b.setAttribute('aria-label', `Ir al slide ${i + 1}`);
    b.addEventListener('click', () => goTo(i, true));
    dotsContainer.appendChild(b);
    return b;
  });

  function goTo(index, userInitiated = false) {
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
    if (userInitiated) resetAutoplay();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    stopAutoplay();
    autoTimer = setInterval(next, INTERVAL_MS);
  }
  function stopAutoplay() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }
  function resetAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  // Wire up arrows
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); resetAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); resetAutoplay(); });

  // Pause on hover (desktop only)
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);

  // Swipe on touch devices
  let touchStartX = null;
  carousel.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  carousel.addEventListener('touchend', e => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) prev(); else next();
      resetAutoplay();
    }
    touchStartX = null;
  });

  // Keyboard accessibility
  carousel.setAttribute('tabindex', '0');
  carousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { prev(); resetAutoplay(); }
    if (e.key === 'ArrowRight') { next(); resetAutoplay(); }
  });

  // Initialize
  slides[0].classList.add('is-active');
  dots[0].classList.add('is-active');
  startAutoplay();
})();
