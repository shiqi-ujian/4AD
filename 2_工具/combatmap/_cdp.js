// Minimal CDP driver for combatmap verification (no deps; Node 21+ native WebSocket)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ART = path.join('E:/yingren/4AD/.dsh-vision-toolkit/artifacts');
const PORT = 9223;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  return res.json();
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message)); else res(m.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + (r.exceptionDetails.exception?.description || ''));
    return r.result && r.result.value;
  }
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const p = path.join(ART, name);
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
    return p;
  }
  async click(x, y, tap = false) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async drag(x1, y1, x2, y2) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
  }
}

async function launch(port, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cmvtest-'));
  const proc = spawn(EDGE, [
    `--remote-debugging-port=${port}`,
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--disable-extensions', '--disable-background-networking',
    `--user-data-dir=${profile}`, '--window-size=1440,900', url
  ], { stdio: 'ignore' });
  // wait for debugger
  let targets;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try { targets = await getTargets(port); if (targets.length) break; } catch {}
  }
  if (!targets) throw new Error('Edge debugger not reachable');
  const page = targets.find(t => t.type === 'page');
  const c = await CDP.connect(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  return { proc, c, profile };
}

module.exports = { launch, CDP, sleep, EDGE, PORT, ART };
