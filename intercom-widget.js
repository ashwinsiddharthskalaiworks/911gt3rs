/**
 * Porsche 911 GT3 RS — GISM Intercom Widget
 *
 * Minimal conversation interface embedded in the bottom-left corner.
 *
 * UX flow:
 *   1. User types a request and presses Send.
 *   2. Widget immediately thanks the user and begins background work.
 *   3. Send button turns into a Stop button for the duration.
 *   4. When the PR is merged and website is live, a success message appears.
 *   5. On failure or stop, an appropriate message is shown.
 *
 * Backend: FastAPI at http://127.0.0.1:8000
 * Repo:    ashwinsiddharthskalaiworks/911gt3rs
 */

(function () {
  'use strict';

  /* ─── CONFIG ──────────────────────────────────────────────────────────────── */
  const API = 'http://127.0.0.1:8000';
  const SSE_TIMEOUT_MS = 35 * 60 * 1000; // 35 minutes — covers merge + sync polling

  /* ─── STATE ───────────────────────────────────────────────────────────────── */
  const S = {
    open: false,
    full: false,
    online: false,
    requestId: null,
    working: false,
    sseConn: null,
    sseTick: null,
    msgs: [
      {
        role: 'ai',
        text: '👋 Welcome! Tell me what changes you\'d like on this Porsche 911 GT3 RS website and I\'ll take care of everything — opening a GitHub issue, writing the code, verifying it, and creating a pull request. Once you approve and merge it, the changes go live automatically.',
        time: _ts()
      }
    ]
  };

  function _ts() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ─── STYLES ──────────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('gism-css')) return;
    const el = document.createElement('style');
    el.id = 'gism-css';
    el.textContent = `
/* ── Reset for widget elements ── */
#gism-root *{box-sizing:border-box;margin:0;padding:0}

/* ── Launcher bubble ── */
#gism-launch{
  position:fixed;bottom:24px;left:24px;z-index:2147483646;
  width:58px;height:58px;border-radius:50%;cursor:pointer;
  background:linear-gradient(145deg,#1a1c24 0%,#0d0e11 45%,#E30613 100%);
  border:2px solid rgba(227,6,19,.55);
  box-shadow:0 8px 28px rgba(0,0,0,.65),0 0 18px rgba(227,6,19,.3);
  display:flex;align-items:center;justify-content:center;
  color:#fff;transition:transform .25s cubic-bezier(.34,1.56,.64,1),
  box-shadow .25s ease,border-color .25s ease;
}
#gism-launch:hover{
  transform:translateY(-3px) scale(1.07);
  box-shadow:0 14px 36px rgba(0,0,0,.75),0 0 28px rgba(227,6,19,.55);
  border-color:#E30613;
}
#gism-launch:active{transform:scale(.94)}
#gism-launch.open{background:#1d2130;border-color:rgba(255,255,255,.2)}

/* pulse dot on launcher */
#gism-dot{
  position:absolute;top:-1px;right:-1px;
  width:12px;height:12px;border-radius:50%;
  background:#10b981;border:2px solid #0a0b0d;
  animation:gism-pulse 2s infinite;
}
#gism-dot.off{background:#f59e0b;animation:none}
@keyframes gism-pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:.55;transform:scale(1.22)}
}

/* ── Panel ── */
#gism-panel{
  position:fixed;left:24px;bottom:96px;z-index:2147483645;
  width:min(420px,calc(100vw - 48px));
  height:min(580px,calc(100vh - 120px));
  background:rgba(9,11,16,.97);
  backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  border:1px solid rgba(255,255,255,.11);border-radius:18px;
  box-shadow:0 24px 72px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.04);
  display:flex;flex-direction:column;overflow:hidden;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  color:#f1f5f9;
  transform-origin:bottom left;
  animation:gism-in .2s ease-out;
}
@keyframes gism-in{
  from{opacity:0;transform:scale(.9) translateY(10px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
#gism-panel.full{
  inset:12px;
  width:calc(100vw - 24px);height:calc(100vh - 24px);
  border-radius:12px;
}

/* ── Header ── */
#gism-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:0 14px;height:52px;flex-shrink:0;
  background:#0c0f17;border-bottom:1px solid rgba(255,255,255,.07);
  user-select:none;
}
.gism-head-left{display:flex;align-items:center;gap:10px}
.gism-head-logo{
  width:28px;height:28px;border-radius:7px;flex-shrink:0;
  background:linear-gradient(135deg,#E30613,#06b6d4);
  display:flex;align-items:center;justify-content:center;color:#fff;
}
.gism-head-name{font-size:.84rem;font-weight:700;letter-spacing:-.01em;line-height:1.1}
.gism-head-sub{font-size:.65rem;color:#64748b;margin-top:1px}
.gism-head-btns{display:flex;gap:5px}
.gism-hbtn{
  background:transparent;border:1px solid transparent;color:#94a3b8;
  width:28px;height:28px;border-radius:6px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background .15s,color .15s;
}
.gism-hbtn:hover{background:rgba(255,255,255,.08);color:#fff}

/* ── Messages ── */
#gism-msgs{
  flex:1;overflow-y:auto;padding:16px 14px;
  display:flex;flex-direction:column;gap:12px;
  scroll-behavior:smooth;
}
#gism-msgs::-webkit-scrollbar{width:3px}
#gism-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}

.gism-msg{
  max-width:90%;border-radius:13px;
  padding:10px 13px;font-size:.84rem;line-height:1.5;
  animation:gism-fade .17s ease-out;
}
@keyframes gism-fade{
  from{opacity:0;transform:translateY(4px)}
  to{opacity:1;transform:translateY(0)}
}
.gism-msg.user{
  align-self:flex-end;
  background:linear-gradient(135deg,#E30613,#b8040f);
  color:#fff;border-bottom-right-radius:3px;
  box-shadow:0 3px 12px rgba(227,6,19,.2);
}
.gism-msg.ai{
  align-self:flex-start;
  background:rgba(255,255,255,.058);
  border:1px solid rgba(255,255,255,.08);
  color:#e2e8f0;border-bottom-left-radius:3px;
}
.gism-msg.ai.ok{
  background:rgba(16,185,129,.1);
  border-color:rgba(16,185,129,.28);color:#d1fae5;
}
.gism-msg.ai.err{
  background:rgba(239,68,68,.1);
  border-color:rgba(239,68,68,.28);color:#fecaca;
}
.gism-msg-meta{font-size:.66rem;opacity:.5;margin-bottom:3px}

/* ── Working strip ── */
#gism-working{
  padding:7px 14px;
  background:rgba(6,182,212,.07);
  border-top:1px solid rgba(6,182,212,.15);
  display:flex;align-items:center;gap:8px;flex-shrink:0;
  font-size:.75rem;color:#7dd3fc;
}
#gism-working-label{flex:1;display:flex;align-items:center;gap:6px}

/* ── Composer ── */
#gism-composer{
  padding:10px 12px;background:#0a0d14;
  border-top:1px solid rgba(255,255,255,.07);flex-shrink:0;
}
#gism-box{
  background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.1);
  border-radius:11px;padding:9px 11px;
  display:flex;flex-direction:column;gap:7px;
  transition:border-color .2s;
}
#gism-box:focus-within{
  border-color:rgba(227,6,19,.5);
  box-shadow:0 0 7px rgba(227,6,19,.15);
}
#gism-ta{
  background:transparent;border:none;outline:none;resize:none;
  color:#fff;font-family:inherit;font-size:.84rem;
  line-height:1.45;width:100%;max-height:100px;
}
#gism-ta::placeholder{color:#475569}
#gism-composer-foot{
  display:flex;justify-content:space-between;align-items:center;gap:8px;
}
.gism-hint{font-size:.66rem;color:#475569}

/* Send / Stop button */
#gism-send-btn{
  border:none;border-radius:8px;padding:6px 14px;
  font-size:.78rem;font-weight:600;cursor:pointer;
  display:flex;align-items:center;gap:5px;flex-shrink:0;
  transition:opacity .15s,transform .15s,background .25s;
}
#gism-send-btn.send{
  background:linear-gradient(135deg,#E30613,#b8040f);color:#fff;
}
#gism-send-btn.send:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
#gism-send-btn.send:disabled{opacity:.38;cursor:not-allowed;transform:none}
#gism-send-btn.stop{
  background:rgba(239,68,68,.15);color:#fca5a5;
  border:1px solid rgba(239,68,68,.3);
}
#gism-send-btn.stop:hover{background:rgba(239,68,68,.25);color:#fecaca}

/* Spinner */
.gism-spin{animation:gism-rot 1s linear infinite;display:inline-block}
@keyframes gism-rot{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(el);
  }

  /* ─── ICONS ───────────────────────────────────────────────────────────────── */
  const I = {
    chat:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r=".5" fill="currentColor"/><circle cx="12" cy="10" r=".5" fill="currentColor"/><circle cx="15" cy="10" r=".5" fill="currentColor"/></svg>`,
    x:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    max:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    min:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    send:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    stop:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    spin:  `<svg class="gism-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`
  };

  /* ─── HELPERS ─────────────────────────────────────────────────────────────── */
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function msg(role, text, variant) {
    S.msgs.push({ role, text, variant: variant || '', time: _ts() });
    renderMsgs();
  }

  function scrollBot() {
    const el = document.getElementById('gism-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function closeSSE() {
    if (S.sseConn) { try { S.sseConn.close(); } catch(_){} S.sseConn = null; }
    if (S.sseTick) { clearTimeout(S.sseTick); S.sseTick = null; }
  }

  /* ─── BACKEND PING ────────────────────────────────────────────────────────── */
  async function ping() {
    try {
      const r = await fetch(`${API}/ready`);
      S.online = r.ok;
    } catch (_) { S.online = false; }
    const dot = document.getElementById('gism-dot');
    if (dot) dot.className = S.online ? '' : 'off';
  }

  /* ─── BUILD DOM ───────────────────────────────────────────────────────────── */
  function buildLauncher() {
    if (document.getElementById('gism-launch')) return;
    const btn = document.createElement('button');
    btn.id = 'gism-launch';
    btn.setAttribute('aria-label', 'Open Porsche Intercom');
    btn.innerHTML = `<div id="gism-launch-ico">${I.chat}</div><div id="gism-dot" class="${S.online ? '' : 'off'}"></div>`;
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
  }

  function buildPanel() {
    if (document.getElementById('gism-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'gism-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Porsche GT3 RS Intercom');
    panel.innerHTML = `
      <div id="gism-head">
        <div class="gism-head-left">
          <div class="gism-head-logo">${I.chat}</div>
          <div>
            <div class="gism-head-name">Porsche 911 GT3 RS</div>
            <div class="gism-head-sub">AI Change Assistant</div>
          </div>
        </div>
        <div class="gism-head-btns">
          <button class="gism-hbtn" id="gism-fs-btn" title="Fullscreen">${I.max}</button>
          <button class="gism-hbtn" id="gism-close-btn" title="Close">${I.x}</button>
        </div>
      </div>

      <div id="gism-msgs"></div>
      <div id="gism-working" style="display:none">
        <div id="gism-working-label">${I.spin} Implementing your changes in the background…</div>
      </div>

      <div id="gism-composer">
        <div id="gism-box">
          <textarea
            id="gism-ta"
            rows="2"
            placeholder="Describe your desired website change…"
          ></textarea>
          <div id="gism-composer-foot">
            <span class="gism-hint">Enter to send · Shift+Enter for new line</span>
            <button id="gism-send-btn" class="send" title="Send request">
              ${I.send} Send
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Fullscreen toggle
    panel.querySelector('#gism-fs-btn').addEventListener('click', () => {
      S.full = !S.full;
      panel.classList.toggle('full', S.full);
      panel.querySelector('#gism-fs-btn').innerHTML = S.full ? I.min : I.max;
    });

    // Close button
    panel.querySelector('#gism-close-btn').addEventListener('click', () => {
      S.open = false;
      panel.style.display = 'none';
      const launch = document.getElementById('gism-launch');
      if (launch) { launch.classList.remove('open'); launch.querySelector('#gism-launch-ico').innerHTML = I.chat; }
    });

    // Textarea keyboard handler
    const ta = panel.querySelector('#gism-ta');
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trySend(); }
    });

    // Send/Stop button
    panel.querySelector('#gism-send-btn').addEventListener('click', () => {
      if (S.working) { handleStop(); } else { trySend(); }
    });

    renderMsgs();
  }

  /* ─── TOGGLE OPEN / CLOSE ─────────────────────────────────────────────────── */
  function toggle() {
    S.open = !S.open;
    const launch = document.getElementById('gism-launch');
    const panel = document.getElementById('gism-panel');

    if (S.open) {
      launch.classList.add('open');
      launch.querySelector('#gism-launch-ico').innerHTML = I.x;
      if (!panel) { buildPanel(); } else { panel.style.display = 'flex'; }
    } else {
      launch.classList.remove('open');
      launch.querySelector('#gism-launch-ico').innerHTML = I.chat;
      if (panel) panel.style.display = 'none';
    }
  }

  /* ─── RENDER ──────────────────────────────────────────────────────────────── */
  function renderMsgs() {
    const el = document.getElementById('gism-msgs');
    if (!el) return;

    el.innerHTML = S.msgs.map(m => `
      <div class="gism-msg ${m.role}${m.variant ? ' ' + m.variant : ''}">
        <div class="gism-msg-meta">${m.role === 'user' ? 'You' : 'Assistant'} · ${m.time}</div>
        <div>${esc(m.text).replace(/\n/g, '<br>')}</div>
      </div>
    `).join('');

    // Show/hide composer vs working bar
    const composer = document.getElementById('gism-composer');
    const bar = document.getElementById('gism-working');
    const btn = document.getElementById('gism-send-btn');
    const ta = document.getElementById('gism-ta');

    if (composer) {
      // Composer is always visible; button toggles between Send and Stop
      if (btn) {
        if (S.working) {
          btn.className = 'stop';
          btn.innerHTML = `${I.stop} Stop`;
          btn.title = 'Stop this request';
        } else {
          btn.className = 'send';
          btn.innerHTML = `${I.send} Send`;
          btn.title = 'Send request';
        }
      }
      if (ta) {
        ta.disabled = S.working;
        ta.placeholder = S.working ? 'Working on your request…' : 'Describe your desired website change…';
      }
    }

    if (bar) bar.style.display = S.working ? 'flex' : 'none';

    scrollBot();
  }

  /* ─── SUBMIT ──────────────────────────────────────────────────────────────── */
  function trySend() {
    if (S.working) return;
    const ta = document.getElementById('gism-ta');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    handleSend(text);
  }

  async function handleSend(text) {
    msg('user', text);
    S.working = true;
    renderMsgs();

    // Immediate acknowledgement
    msg('ai', "Thanks! I've received your request. I'm now opening a GitHub issue, writing the code, verifying it, and creating a pull request — all in the background. I'll notify you here once the changes are live. ✨");

    if (!S.online) {
      // Offline demo
      await runOfflineDemo();
      return;
    }

    try {
      // 1. Create the request
      const cr = await fetch(`${API}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (!cr.ok) {
        const body = await cr.json().catch(() => ({}));
        if (cr.status === 409) {
          setIdle();
          msg('ai', "⚠️ A request is already being processed. Please wait for it to finish, or press Stop to cancel it.");
          return;
        }
        throw new Error(body.detail || `HTTP ${cr.status}`);
      }

      const reqData = await cr.json();
      S.requestId = reqData.id;

      // 2. Auto-advance through clarifications and confirmation silently
      await autoAdvance(reqData);

    } catch (err) {
      setIdle();
      msg('ai', `⚠️ Could not connect to the backend: ${err.message}. Make sure the server is running at port 8000.`, 'err');
    }
  }

  /* ─── AUTO-ADVANCE (silently handle clarification → confirmation → dispatch) */
  async function autoAdvance(data) {
    const id = data.id || S.requestId;
    if (!id) { setIdle(); return; }

    let current = data;
    let loops = 0;

    while (loops < 6) {
      loops++;

      if (current.status === 'AWAITING_CLARIFICATION') {
        // Auto-answer: tell the LLM to proceed with its best judgment
        const qs = current.clarification_questions || ['general'];
        const answers = qs.map(q => ({
          question: q,
          answer: 'Please proceed with your best judgment based on the original request.'
        }));
        try {
          const r = await fetch(`${API}/api/requests/${id}/clarifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
          });
          if (!r.ok) break;
          current = await r.json();
        } catch (_) { break; }

      } else if (current.status === 'AWAITING_CONFIRMATION') {
        try {
          const r = await fetch(`${API}/api/requests/${id}/confirm`, { method: 'POST' });
          if (!r.ok) break;
          current = await r.json().catch(() => ({ status: 'PROCESSING' }));
        } catch (_) { break; }
        // Confirmed — now wait for SSE events
        connectSSE(id);
        return;

      } else if (['PROCESSING', 'SPEC_FROZEN'].includes(current.status)) {
        connectSSE(id);
        return;

      } else if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(current.status)) {
        handleTerminal(current.status, '');
        return;

      } else {
        // Unknown status — connect SSE and let events drive
        connectSSE(id);
        return;
      }
    }

    // Fallback
    connectSSE(id);
  }

  /* ─── SSE ─────────────────────────────────────────────────────────────────── */
  function connectSSE(requestId) {
    closeSSE();
    try {
      const es = new EventSource(`${API}/api/requests/${requestId}/events`);
      S.sseConn = es;

      // ── USER-VISIBLE TERMINAL EVENTS ──
      es.addEventListener('website_live', () => {
        closeSSE();
        handleTerminal('COMPLETED', '');
      });

      es.addEventListener('workflow_failed', (e) => {
        closeSSE();
        let detail = '';
        try { detail = JSON.parse(e.data)?.message || ''; } catch (_) {}
        handleTerminal('FAILED', detail);
      });

      es.addEventListener('workflow_cancelled', () => {
        closeSSE();
        handleTerminal('CANCELLED', '');
      });

      // ── workflow_completed fires when PR is created & coding job done ──
      // We wait for website_live (post-merge sync) but fall back after 60s if it never comes
      es.addEventListener('workflow_completed', () => {
        if (!S.working) return;
        // Give sync service 60 s to emit website_live
        S.sseTick = setTimeout(() => {
          if (S.working) { closeSSE(); handleTerminal('COMPLETED', ''); }
        }, 60000);
      });

      // Safety timeout
      const safetyTick = setTimeout(() => {
        if (S.working) { closeSSE(); handleTerminal('FAILED', 'Request timed out. Please try again.'); }
      }, SSE_TIMEOUT_MS);

      es.onerror = () => {
        // Poll fallback on SSE error
        clearTimeout(safetyTick);
        setTimeout(() => pollStatus(requestId), 4000);
      };

    } catch (e) {
      console.warn('[GISM] SSE unavailable:', e);
      pollStatus(requestId);
    }
  }

  /* ─── POLL FALLBACK ───────────────────────────────────────────────────────── */
  function pollStatus(requestId) {
    let attempts = 0;
    const iv = setInterval(async () => {
      if (!S.working || attempts > 180) { clearInterval(iv); return; }
      attempts++;
      try {
        const r = await fetch(`${API}/api/requests/${requestId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(d.status)) {
          clearInterval(iv);
          handleTerminal(d.status, '');
        }
      } catch (_) {}
    }, 10000);
  }

  /* ─── TERMINAL ────────────────────────────────────────────────────────────── */
  function handleTerminal(status, detail) {
    setIdle();
    if (status === 'COMPLETED') {
      msg('ai', '✅ Your changes have been implemented, merged, and are now live on the website!', 'ok');
    } else if (status === 'CANCELLED') {
      msg('ai', 'Request stopped. Feel free to describe a new change whenever you\'re ready.');
    } else {
      const extra = detail ? ` Details: ${detail}` : '';
      msg('ai', `❌ Something went wrong while implementing your request.${extra} Please try again with more detail.`, 'err');
    }
  }

  /* ─── STOP (user initiated) ───────────────────────────────────────────────── */
  async function handleStop() {
    const id = S.requestId;
    closeSSE();
    setIdle();
    msg('ai', 'Request stopped. You can submit a new request whenever you\'re ready.');

    if (id && S.online) {
      try { await fetch(`${API}/api/requests/${id}/cancel`, { method: 'POST' }); } catch (_) {}
    }
  }

  /* ─── HELPERS ─────────────────────────────────────────────────────────────── */
  function setIdle() {
    S.working = false;
    S.requestId = null;
    renderMsgs();
  }

  /* ─── OFFLINE DEMO ────────────────────────────────────────────────────────── */
  async function runOfflineDemo() {
    await new Promise(r => setTimeout(r, 3500));
    if (!S.working) return; // stopped by user
    setIdle();
    msg('ai', '✅ [Offline demo] Changes simulated! Start the backend server to apply real changes.', 'ok');
  }

  /* ─── ROOT DIV wrapper ────────────────────────────────────────────────────── */
  function ensureRoot() {
    if (!document.getElementById('gism-root')) {
      const r = document.createElement('div');
      r.id = 'gism-root';
      document.body.appendChild(r);
    }
  }

  /* ─── INIT ────────────────────────────────────────────────────────────────── */
  function init() {
    ensureRoot();
    injectCSS();
    buildLauncher();
    ping();
    setInterval(ping, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
