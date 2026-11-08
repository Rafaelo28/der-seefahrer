// Verbindung zu Freunden für die Online-Seeschlacht: über PeerJS (direkt von Gerät zu Gerät, ohne eigenen Server –
// wie bei Gamble Klicker) oder zum Testen lokal zwischen zwei Tabs desselben Browsers (BroadcastChannel, ?lokal=1).
// Ein Kanal hat: send(obj), onMessage(fn), onClose(fn), close(). Raum-Codes nie an die Besucherzählung schicken!
window.SF = window.SF || {};

(function () {
  const PREFIX = 'der-seefahrer-duell-';
  const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I
  const CODE_LENGTH = 4;

  const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[SF.rng.int(CODE_CHARS.length)]).join('');
  const cleanCode = text => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  const validCode = code => code.length === CODE_LENGTH && [...code].every(c => CODE_CHARS.includes(c));
  const useLocal = () => !!window.SF_DUEL_LOCAL || (typeof location !== 'undefined' && /[?&]lokal=1/.test(location.search));

  // PeerJS erst laden, wenn man online spielen will
  let loading = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEERJS;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('PeerJS nicht geladen')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // Einheitlicher Kanal aus einer PeerJS-Verbindung
  function wrapPeer(conn, peer) {
    const handlers = { msg: [], close: [] };
    let closed = false;
    const fireClose = () => { if (!closed) { closed = true; handlers.close.forEach(fn => fn()); } };
    conn.on('data', d => handlers.msg.forEach(fn => fn(d)));
    conn.on('close', fireClose);
    conn.on('error', fireClose);
    return {
      send: obj => { if (!closed && conn.open) conn.send(obj); },
      onMessage: fn => handlers.msg.push(fn),
      onClose: fn => handlers.close.push(fn),
      close: () => { fireClose(); try { conn.close(); peer.destroy(); } catch (e) { /* schon zu */ } },
    };
  }

  // Lokaler Kanal zwischen zwei Tabs (gleicher Browser)
  function wrapLocal(bc, role) {
    const handlers = { msg: [], close: [] };
    let closed = false;
    bc.onmessage = ev => {
      const d = ev.data;
      if (!d || d.from === role) return;
      if (d.bye) { if (!closed) { closed = true; handlers.close.forEach(fn => fn()); } return; }
      if (d.m) handlers.msg.forEach(fn => fn(d.m));
    };
    return {
      send: obj => { if (!closed) bc.postMessage({ from: role, m: obj }); },
      onMessage: fn => handlers.msg.push(fn),
      onClose: fn => handlers.close.push(fn),
      close: () => { if (!closed) { closed = true; bc.postMessage({ from: role, bye: true }); } setTimeout(() => bc.close(), 50); },
    };
  }

  // Raum öffnen: onConnect(kanal), sobald ein Freund beitritt; onError('taken' | 'net')
  async function host(code, onConnect, onError) {
    if (useLocal()) {
      const bc = new BroadcastChannel(PREFIX + code);
      let done = false;
      bc.onmessage = ev => {
        if (done || !ev.data || !ev.data.join) return;
        done = true;
        bc.postMessage({ welcome: true });
        onConnect(wrapLocal(bc, 'host'));
      };
      return { close: () => { if (!done) bc.close(); } };
    }
    await loadPeer();
    const peer = new window.Peer(PREFIX + code, { debug: 0 });
    let done = false;
    peer.on('connection', conn => {
      if (done) { conn.close(); return; } // nur ein Freund pro Raum
      done = true;
      conn.on('open', () => onConnect(wrapPeer(conn, peer)));
    });
    peer.on('error', err => { if (!done) onError(err && err.type === 'unavailable-id' ? 'taken' : 'net'); });
    return { close: () => { if (!done) peer.destroy(); } };
  }

  // Raum beitreten: onConnect(kanal); onError('notfound' | 'net')
  async function join(code, onConnect, onError) {
    if (useLocal()) {
      const bc = new BroadcastChannel(PREFIX + code);
      let done = false;
      bc.onmessage = ev => {
        if (done || !ev.data || !ev.data.welcome) return;
        done = true;
        onConnect(wrapLocal(bc, 'guest'));
      };
      bc.postMessage({ join: true });
      setTimeout(() => { if (!done) { bc.close(); onError('notfound'); } }, 2500);
      return { close: () => { if (!done) bc.close(); } };
    }
    await loadPeer();
    const peer = new window.Peer({ debug: 0 });
    let done = false;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => { done = true; onConnect(wrapPeer(conn, peer)); });
    });
    peer.on('error', err => { if (!done) onError(err && err.type === 'peer-unavailable' ? 'notfound' : 'net'); });
    setTimeout(() => { if (!done) { onError('notfound'); try { peer.destroy(); } catch (e) { /* egal */ } } }, 12000);
    return { close: () => { if (!done) peer.destroy(); } };
  }

  SF.net = { PREFIX, CODE_LENGTH, newCode, cleanCode, validCode, useLocal, host, join, wrapLocal };
})();
