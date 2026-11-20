const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
const closeMenu = () => {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
};
menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    navigation.querySelectorAll('details[open]').forEach(details => {
      details.open = false;
      details.querySelector('summary').focus();
    });
    if (navigation.classList.contains('is-open')) {
      closeMenu();
      menuButton.focus();
    }
  }
});
document.addEventListener('click', event => {
  navigation.querySelectorAll('details[open]').forEach(details => {
    if (!details.contains(event.target)) details.open = false;
  });
});
document.querySelector('[data-skip]')?.addEventListener('click', () => {
  const target = document.querySelector('main h1') || document.querySelector('main');
  target.setAttribute('tabindex', '-1');
  target.focus();
});

const form = document.querySelector('#contact-form');
if (form) {
  const service = form.elements.service;
  const requestedService = new URLSearchParams(location.search).get('service');
  if ([...service.options].some(option => option.value === requestedService)) service.value = requestedService;
}

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
