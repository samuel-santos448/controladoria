let menuCleanup = () => {};
function resetResponsiveMenu() { menuCleanup(); menuCleanup = () => {}; }
function setupResponsiveMenu() {
  const sidebar = $('#sidenav'), main = $('#app-main'), toggle = $('#menu-toggle'), close = $('#menu-close'), overlay = $('#menu-overlay');
  const media = window.matchMedia('(max-width:1000px)'); let opened = false;
  function setOpen(value, restoreFocus = true) {
    opened = value && media.matches;
    $('.shell').classList.toggle('menu-open', opened);
    toggle.setAttribute('aria-expanded', String(opened)); overlay.hidden = !opened;
    main.inert = opened; sidebar.inert = media.matches && !opened;
    sidebar.setAttribute('aria-hidden', String(media.matches && !opened));
    if (opened) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); }
    else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
    document.body.style.overflow = opened ? 'hidden' : '';
    if (opened) close.focus(); else if (restoreFocus && media.matches) toggle.focus();
  }
  const keydown = e => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    if (e.key === 'Tab') {
      const buttons = Array.from(sidebar.querySelectorAll('button:not([disabled]),a[href]'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const resized = () => setOpen(false, false);
  toggle.onclick = () => setOpen(!opened); close.onclick = overlay.onclick = () => setOpen(false);
  document.addEventListener('keydown', keydown); media.addEventListener('change', resized); setOpen(false, false);
  menuCleanup = () => { setOpen(false, false); document.removeEventListener('keydown', keydown); media.removeEventListener('change', resized); };
}
