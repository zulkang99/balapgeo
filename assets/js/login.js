// Halaman login: nama & sekolah hanya dikirim lewat alamat halaman (?nama=&sekolah=), tidak disimpan di mana pun.
(function () {
  var qs = new URLSearchParams(location.search);
  var page = document.getElementById('login-page');
  var exitBtn = document.getElementById('lg-exit');
  var dlg = document.getElementById('lg-dialog');

  if (qs.get('nama')) {
    page.remove();
    exitBtn.hidden = false;
    exitBtn.onclick = function () { location.href = location.pathname; };
    return;
  }

  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = document.getElementById('lg-nama').value.trim();
    var s = document.getElementById('lg-sekolah').value.trim();
    if (!n || !s) return;
    location.search = new URLSearchParams({ nama: n, sekolah: s }).toString();
  });

  function close() { dlg.hidden = true; }
  document.getElementById('lg-info-btn').onclick = function () { dlg.hidden = false; };
  dlg.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
