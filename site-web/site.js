// Taxi J7 Rive-Sud — script commun à toutes les pages
(function () {
  // Menu mobile
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('menu');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Année automatique dans le pied de page
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Suivi des clics « Appeler » et « Courriel » dans Google Tag Manager
  // (événements : clic_appel, clic_courriel — à utiliser comme conversions Google Ads / GA4)
  function push(event, el) {
    window.dataLayer = window.dataLayer || [];
    var zone = el.closest('header, section, footer, .call-bar');
    window.dataLayer.push({ event: event, emplacement: zone ? (zone.id || zone.className || zone.tagName.toLowerCase()) : 'page', page: location.pathname });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    push(a.getAttribute('href').indexOf('tel:') === 0 ? 'clic_appel' : 'clic_courriel', a);
  });
})();
