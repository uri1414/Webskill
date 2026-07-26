/* Mid-Valley Facility Services — shared behavior for interior pages */
(function () {
  // Header shadow on scroll
  var header = document.querySelector('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile menu
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    var toggle = function (open) {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () { toggle(!menu.classList.contains('open')); });
    // Close when a real link (not the Services summary) is tapped
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.qa').forEach(function (qa) {
    var btn = qa.querySelector('button');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = qa.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el, i) {
      el.style.transitionDelay = (i % 4 * 70) + 'ms';
      io.observe(el);
    });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
