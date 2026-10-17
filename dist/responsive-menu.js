let menuCleanup = () => {};
function resetResponsiveMenu() { menuCleanup(); menuCleanup = () => {}; }
function setupResponsiveMenu() {
  const sidebar = $('#sidenav'), main = $('#app-main'), toggle = $('#menu-toggle'), close = $('#menu-close'), overlay = $('#menu-overlay');
  const media = window.matchMedia('(max-width:1000px)'); let opened = false;
  function setOpen(value, restoreFocus = true) {
    opened = Boolean(value);
    $('.shell').classList.toggle('menu-open', opened);
    toggle.setAttribute('aria-expanded', String(opened)); overlay.hidden = !opened || !media.matches;
    main.inert = opened && media.matches; sidebar.inert = !opened;
    sidebar.setAttribute('aria-hidden', String(!opened));
    if (opened && media.matches) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); }
    else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
    document.body.style.overflow = opened && media.matches ? 'hidden' : '';
    if (opened) close.focus(); else if (restoreFocus) toggle.focus();
  }
  const keydown = e => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    if (e.key === 'Tab' && media.matches) {
      const buttons = Array.from(sidebar.querySelectorAll('button:not([disabled]),a[href]'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  toggle.onclick = () => setOpen(!opened); close.onclick = overlay.onclick = () => setOpen(false);
  const resized=()=>setOpen(opened,false);media.addEventListener('change',resized);
  document.addEventListener('keydown', keydown); setOpen(false, false);
  menuCleanup = () => { setOpen(false, false); document.removeEventListener('keydown', keydown);media.removeEventListener('change',resized); };
}
