/* Baseline Studio — shared behavior for interior pages */
(function () {
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('mobileMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // FAQ accordion
  var allQa = document.querySelectorAll('.qa');
  allQa.forEach(function (qa) {
    var btn = qa.querySelector('button');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var willOpen = !qa.classList.contains('open');
      allQa.forEach(function (o) { o.classList.remove('open'); var b = o.querySelector('button'); if (b) b.setAttribute('aria-expanded', 'false'); });
      if (willOpen) { qa.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal, .step').forEach(function (el) { io.observe(el); });
  }
})();
