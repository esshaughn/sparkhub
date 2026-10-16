// The website (/welcome, Design v9-1): the bar's links highlight the section in view, and a phone frame whose
// screenshot doesn't load is hidden (the hero falls back to a photo).
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-site-nav] a'));
  var mark = function (id) {
    links.forEach(function (a) {
      if (a.getAttribute('href') !== '#' + id) { a.removeAttribute('aria-current'); return; }
      a.setAttribute('aria-current', 'true');
      var nav = a.parentNode;   // on a phone the links scroll sideways: keep the current one in view
      if (a.offsetLeft < nav.scrollLeft || a.offsetLeft + a.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = a.offsetLeft - 8;
    });
  };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('[data-section]').forEach(function (el) { io.observe(el); });
  }
  var hide = function (img) {
    var phone = img.closest('.phone');
    if (!phone) return;
    phone.hidden = true;
    var pics = phone.closest('[data-pics]');
    if (pics && !pics.querySelector('.phone:not([hidden])')) {
      pics.classList.add('photo-only');
      var ph = pics.querySelector('.hero-photo');
      if (ph) ph.hidden = false;
    }
  };
  document.querySelectorAll('.phone img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) hide(img);
    else img.addEventListener('error', function () { hide(img); });
  });
})();
