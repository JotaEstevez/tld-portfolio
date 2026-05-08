/* ============================================================
   TLD Portfolio · Access Gate
   Single-page gate con master password + claves de invitado
   firmadas. Todo client-side — no es bunker, es un filtro.
   ============================================================ */
(function() {
  'use strict';

  // === CONFIG ===
  //
  // Cómo rotar (todo cambio requiere push a main):
  //
  //   1. Invalidar SOLO las claves de invitado emitidas hasta ahora
  //      (mantener tu master): cambia SECRET por cualquier string nuevo.
  //
  //   2. Invalidar TAMBIÉN tu master password (ej: se ha filtrado):
  //      cambia MASTER_PASS por una nueva (y opcionalmente SECRET también).
  //
  //   3. Invalidar UNA clave concreta sin afectar al resto:
  //      no es posible sin backend — toca rotar SECRET y reemitir las
  //      válidas que quieras mantener.
  //
  // Nota: las sesiones ya activas (pestañas abiertas) no se expulsan.
  // La rotación afecta a re-entradas/nuevas sesiones.
  //
  var MASTER_PASS = 'tld-2026-master';
  var SECRET = 'tld-portfolio-sig-9k3mZ';

  var SESSION_KEY = 'tld_auth';

  // === FNV-1a 32-bit (hash no criptográfico — suficiente para firmar claves cortas) ===
  function fnv1a(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var out = (h >>> 0).toString(36) + (Math.imul(h, 31) >>> 0).toString(36);
    return out.toUpperCase();
  }

  function sign(payload) {
    return fnv1a(SECRET + MASTER_PASS + payload).slice(0, 6);
  }

  // === CLAVES DE INVITADO ===
  var KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function generateGuestKey() {
    var payload = '';
    for (var i = 0; i < 6; i++) {
      payload += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
    }
    return 'inv-' + payload + '-' + sign(payload);
  }

  function validateKey(key) {
    if (!key) return false;
    var trimmed = String(key).trim();
    if (trimmed === MASTER_PASS) return 'master';
    var m = trimmed.match(/^inv-([A-Z2-9]{6})-([A-Z0-9]{1,12})$/i);
    if (!m) return false;
    return sign(m[1].toUpperCase()) === m[2].toUpperCase() ? 'guest' : false;
  }

  // === URL TOKEN ===
  function extractToken() {
    var p = new URLSearchParams(location.search);
    return p.get('invitado');
  }

  function cleanUrl() {
    var p = new URLSearchParams(location.search);
    p.delete('invitado');
    var s = p.toString();
    history.replaceState({}, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  // === INIT ===
  // 1. Si la URL trae token de invitado válido, autorizar
  var token = extractToken();
  if (token) {
    var role = validateKey(decodeURIComponent(token));
    if (role) {
      sessionStorage.setItem(SESSION_KEY, role);
      cleanUrl();
    }
  }

  var currentRole = sessionStorage.getItem(SESSION_KEY);

  // 2. Ya autorizado: desbloquear y mostrar admin si es master
  if (currentRole) {
    document.documentElement.classList.remove('tld-locked');
    if (currentRole === 'master') {
      showAdminButton();
    }
    return;
  }

  // 3. No autorizado: montar gate
  buildGate();

  // === GATE UI ===
  function buildGate() {
    var gate = document.createElement('div');
    gate.id = 'tld-gate';
    gate.className = 'tld-gate-overlay';
    gate.innerHTML =
      '<div class="tld-gate-card">' +
        '<div class="tld-gate-mono">The Last Dance<span class="tld-gate-dot">.</span></div>' +
        '<div class="tld-gate-kicker">Acceso por invitación</div>' +
        '<h1 class="tld-gate-title">Este portfolio es <em>privado</em>.</h1>' +
        '<p class="tld-gate-lede">Si has llegado por enlace con invitación, ya estás dentro. Si te han pasado solo la clave, pégala abajo.</p>' +
        '<form class="tld-gate-form" id="tld-gate-form">' +
          '<input type="text" id="tld-gate-input" placeholder="inv-XXXXXX-XXXXXX o password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />' +
          '<button type="submit">Entrar <span class="tld-arrow">→</span></button>' +
        '</form>' +
        '<div class="tld-gate-error" id="tld-gate-error"></div>' +
        '<p class="tld-gate-foot">¿Crees que es un error? Escribe a <a href="mailto:jestevez@thelastdance.company">jestevez@thelastdance.company</a>.</p>' +
      '</div>';
    document.body.appendChild(gate);

    var input = document.getElementById('tld-gate-input');
    var form = document.getElementById('tld-gate-form');
    var err = document.getElementById('tld-gate-error');

    setTimeout(function() { input.focus(); }, 50);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var v = input.value.trim();
      var role = validateKey(v);
      if (!role) {
        err.textContent = 'Clave no válida';
        input.classList.add('tld-shake');
        setTimeout(function() { input.classList.remove('tld-shake'); }, 400);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, role);
      document.documentElement.classList.remove('tld-locked');
      gate.remove();
      if (role === 'master') showAdminButton();
    });
  }

  // === ADMIN FAB (solo master) ===
  function showAdminButton() {
    if (document.getElementById('tld-admin-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'tld-admin-btn';
    btn.className = 'tld-admin-fab';
    btn.innerHTML = '<span class="tld-admin-icon">+</span>Generar invitación';
    btn.title = 'Crea una clave para enviar a un prospecto';
    btn.addEventListener('click', openAdminModal);
    document.body.appendChild(btn);

    var lock = document.createElement('button');
    lock.id = 'tld-lock-btn';
    lock.className = 'tld-lock-fab';
    lock.innerHTML = 'Cerrar sesión';
    lock.title = 'Vuelve al gate';
    lock.addEventListener('click', function() {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });
    document.body.appendChild(lock);
  }

  function openAdminModal() {
    var key = generateGuestKey();
    // El URL del enlace apunta al raíz del portfolio (donde resuelva GitHub Pages o el dominio)
    var basePath = location.pathname.replace(/\/casos\/.*$/, '/').replace(/\/[^\/]*\.html$/, '/');
    var url = location.origin + basePath + '?invitado=' + key;

    var modal = document.createElement('div');
    modal.id = 'tld-admin-modal';
    modal.className = 'tld-admin-modal-overlay';
    modal.innerHTML =
      '<div class="tld-admin-modal-card">' +
        '<button class="tld-admin-close" id="tld-admin-close" aria-label="Cerrar">×</button>' +
        '<div class="tld-gate-kicker">Nueva invitación</div>' +
        '<h2 class="tld-admin-title">Lista para <em>enviar</em>.</h2>' +
        '<p class="tld-admin-lede">Copia el enlace y mándalo a tu prospecto. Funciona hasta que rotes la password maestra.</p>' +

        '<div class="tld-admin-block">' +
          '<div class="tld-admin-label">Enlace directo · recomendado</div>' +
          '<div class="tld-admin-value" id="tld-admin-url"></div>' +
          '<button class="tld-admin-copy" data-target="url">Copiar enlace</button>' +
        '</div>' +

        '<div class="tld-admin-block">' +
          '<div class="tld-admin-label">Solo la clave</div>' +
          '<div class="tld-admin-value tld-admin-mono" id="tld-admin-key"></div>' +
          '<button class="tld-admin-copy" data-target="key">Copiar clave</button>' +
        '</div>' +

        '<button class="tld-admin-new" id="tld-admin-new">Generar otra</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('tld-admin-url').textContent = url;
    document.getElementById('tld-admin-key').textContent = key;

    document.getElementById('tld-admin-close').addEventListener('click', function() { modal.remove(); });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('tld-admin-new').addEventListener('click', function() {
      modal.remove();
      openAdminModal();
    });

    var copies = modal.querySelectorAll('.tld-admin-copy');
    for (var i = 0; i < copies.length; i++) {
      (function(b) {
        b.addEventListener('click', function() {
          var target = b.getAttribute('data-target');
          var v = target === 'url' ? url : key;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(v).then(function() {
              var orig = b.textContent;
              b.textContent = 'Copiado ✓';
              setTimeout(function() { b.textContent = orig; }, 1500);
            });
          }
        });
      })(copies[i]);
    }
  }

  // expose minimal debug API
  window.tldGate = {
    lock: function() { sessionStorage.removeItem(SESSION_KEY); location.reload(); }
  };
})();
