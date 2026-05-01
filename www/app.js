(function () {
  'use strict';

  const form = document.getElementById('form');
  const out = document.getElementById('yaml-out');
  const statusEl = document.getElementById('status');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const btnReset = document.getElementById('btn-reset');

  const defaults = {
    ports: [],
    volumes: ['./scripts:/scripts'],
    environment: [],
    devices: ['/dev/net/tun'],
  };

  const placeholders = {
    ports: 'ej. 8080:80',
    volumes: 'ej. ./data:/var/data[:ro]',
    environment: 'ej. NODE_ENV=production',
    devices: 'ej. /dev/net/tun',
  };

  function addRow(kind, value = '') {
    const list = form.querySelector(`[data-dyn="${kind}"] .dyn-list`);
    const row = document.createElement('div');
    row.className = 'dyn-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.name = kind;
    input.value = value;
    input.placeholder = placeholders[kind] || '';

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'dyn-remove';
    rm.title = 'eliminar';
    rm.textContent = '×';
    rm.addEventListener('click', () => { row.remove(); render(); });

    row.append(input, rm);
    list.appendChild(row);
    return input;
  }

  form.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.add;
      addRow(kind).focus();
      render();
    });
  });

  function seed() {
    Object.entries(defaults).forEach(([k, vals]) => vals.forEach(v => addRow(k, v)));
    const cap = form.querySelector('input[name="cap"][value="NET_ADMIN"]');
    if (cap) cap.checked = true;
    form.querySelector('input[name="command"]').value = '["/bin/bash", "/scripts/main.sh"]';
  }

  function readConfig() {
    const data = new FormData(form);
    const get = (k) => (data.get(k) || '').trim();
    const all = (k) => Array.from(form.querySelectorAll(`[name="${k}"]`))
      .map(i => i.value.trim()).filter(Boolean);

    return {
      serviceName: get('serviceName') || 'service',
      image: get('image'),
      containerName: get('containerName'),
      hostname: get('hostname'),
      restart: get('restart'),
      networkMode: get('networkMode'),
      workingDir: get('workingDir'),
      user: get('user'),
      ports: all('ports'),
      volumes: all('volumes'),
      environment: all('environment'),
      devices: all('devices'),
      capAdd: Array.from(form.querySelectorAll('input[name="cap"]:checked')).map(i => i.value),
      privileged: form.querySelector('input[name="privileged"]').checked,
      stdinOpen: form.querySelector('input[name="stdinOpen"]').checked,
      tty: form.querySelector('input[name="tty"]').checked,
      entrypoint: get('entrypoint'),
      command: get('command'),
    };
  }

  function needsQuotes(s) {
    if (!s) return false;
    if (/^\s|\s$/.test(s)) return true;
    if (/^(true|false|yes|no|on|off|null|~)$/i.test(s)) return true;
    if (/^-?\d+(\.\d+)?$/.test(s)) return true;
    if (/^[&*!|>?%@`]/.test(s)) return true;
    if (/[:#]/.test(s)) return true;
    return false;
  }

  function yamlString(s) {
    if (!needsQuotes(s)) return s;
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function emitMaybeArray(v) {
    const t = v.trim();
    if (t.startsWith('[') && t.endsWith(']')) return t;
    return yamlString(t);
  }

  function gen(cfg) {
    const lines = ['services:', `  ${cfg.serviceName}:`];
    const ind = '    ';
    const push = (k, v) => lines.push(`${ind}${k}: ${v}`);

    if (cfg.image) push('image', yamlString(cfg.image));
    if (cfg.containerName) push('container_name', yamlString(cfg.containerName));
    if (cfg.hostname) push('hostname', yamlString(cfg.hostname));
    if (cfg.networkMode) push('network_mode', `"${cfg.networkMode}"`);
    if (cfg.restart) push('restart', cfg.restart);
    if (cfg.workingDir) push('working_dir', yamlString(cfg.workingDir));
    if (cfg.user) push('user', yamlString(cfg.user));
    if (cfg.privileged) push('privileged', 'true');
    if (cfg.stdinOpen) push('stdin_open', 'true');
    if (cfg.tty) push('tty', 'true');

    if (cfg.ports.length) {
      lines.push(`${ind}ports:`);
      cfg.ports.forEach(p => lines.push(`${ind}  - "${p}"`));
    }
    if (cfg.volumes.length) {
      lines.push(`${ind}volumes:`);
      cfg.volumes.forEach(v => lines.push(`${ind}  - ${yamlString(v)}`));
    }
    if (cfg.environment.length) {
      lines.push(`${ind}environment:`);
      cfg.environment.forEach(e => lines.push(`${ind}  - ${yamlString(e)}`));
    }
    if (cfg.capAdd.length) {
      lines.push(`${ind}cap_add:`);
      cfg.capAdd.forEach(c => lines.push(`${ind}  - ${c}`));
    }
    if (cfg.devices.length) {
      lines.push(`${ind}devices:`);
      cfg.devices.forEach(d => lines.push(`${ind}  - ${yamlString(d)}`));
    }
    if (cfg.entrypoint) push('entrypoint', emitMaybeArray(cfg.entrypoint));
    if (cfg.command) push('command', emitMaybeArray(cfg.command));

    return lines.join('\n') + '\n';
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function colorValue(rest) {
    const t = rest.trim();
    if (!t) return escHtml(rest);
    if (/^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t)) {
      return escHtml(rest).replace(escHtml(t), `<span class="ys">${escHtml(t)}</span>`);
    }
    if (/^(true|false)$/i.test(t)) {
      return escHtml(rest).replace(t, `<span class="yb">${t}</span>`);
    }
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      return escHtml(rest).replace(t, `<span class="yn">${t}</span>`);
    }
    return escHtml(rest);
  }

  function highlight(yaml) {
    return yaml.split('\n').map(line => {
      if (!line) return '';
      const m1 = line.match(/^(\s*)(- )(.*)$/);
      if (m1) return `${m1[1]}<span class="yh">${m1[2]}</span>${colorValue(m1[3])}`;
      const m2 = line.match(/^(\s*)([A-Za-z0-9_]+):(.*)$/);
      if (m2) return `${m2[1]}<span class="yk">${m2[2]}</span>:${colorValue(m2[3])}`;
      return escHtml(line);
    }).join('\n');
  }

  let lastYaml = '';
  let renderTimer = null;
  function render() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const cfg = readConfig();
      const yaml = gen(cfg);
      lastYaml = yaml;
      out.innerHTML = highlight(yaml);
      statusEl.className = 'status ok';
      statusEl.textContent = 'actualizado';
    }, 30);
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    const sel = document.getSelection();
    const prev = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    if (prev) { sel.removeAllRanges(); sel.addRange(prev); }
    return ok;
  }

  btnCopy.addEventListener('click', async () => {
    const ok = await copyText(lastYaml);
    if (ok) {
      statusEl.className = 'status copied';
      statusEl.textContent = 'copiado';
      setTimeout(() => {
        statusEl.className = 'status ok';
        statusEl.textContent = 'actualizado';
      }, 1500);
    } else {
      statusEl.className = 'status';
      statusEl.textContent = 'error al copiar';
    }
  });

  btnDownload.addEventListener('click', () => {
    const blob = new Blob([lastYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    a.click();
    URL.revokeObjectURL(url);
  });

  btnReset.addEventListener('click', () => {
    if (!confirm('¿Resetear el formulario?')) return;
    form.reset();
    form.querySelectorAll('.dyn-list').forEach(l => (l.innerHTML = ''));
    seed();
    render();
  });

  const lockBtn = document.getElementById('lock-name');
  const svcInput = form.querySelector('input[name="serviceName"]');
  const cnInput = form.querySelector('input[name="containerName"]');
  const hnInput = form.querySelector('input[name="hostname"]');

  function applyLock(locked) {
    lockBtn.dataset.locked = String(locked);
    lockBtn.title = locked
      ? 'desbloquear: editar container_name y hostname libremente'
      : 'bloquear: sincroniza container_name y hostname con service name';
    cnInput.readOnly = locked;
    hnInput.readOnly = locked;
    if (locked) {
      cnInput.value = svcInput.value;
      hnInput.value = svcInput.value;
    }
  }

  lockBtn.addEventListener('click', () => {
    applyLock(lockBtn.dataset.locked !== 'true');
    render();
  });

  svcInput.addEventListener('input', () => {
    if (lockBtn.dataset.locked === 'true') {
      cnInput.value = svcInput.value;
      hnInput.value = svcInput.value;
    }
  });

  seed();
  applyLock(true);
  render();
})();
