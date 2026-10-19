/**
 * FRANK uptime monitor (Cloudflare Worker + Cron Trigger, free plan).
 * Every 10 minutes it pings the two Render services (keeps free instances warm
 * and catches outages). On failure it can post to a WeCom / Feishu group robot
 * when ALERT_WEBHOOK is configured.
 */
const TARGETS = [
  { name: 'flutek-agent', base: 'https://flutek-agent.onrender.com', paths: ['/healthz', '/api/health'] },
  { name: 'flutek-inbox', base: 'https://flutek-inbox.onrender.com', paths: ['/healthz', '/api/health'] }
];
const TIMEOUT_MS = 25000;

async function check(target) {
  const started = Date.now();
  const results = [];
  for (const p of target.paths) {
    try {
      const res = await fetch(target.base + p, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = await res.text();
      results.push({ path: p, status: res.status, ok: res.ok, body: body.slice(0, 160) });
    } catch (e) {
      results.push({ path: p, status: 0, ok: false, error: String((e && e.message) || e) });
    }
  }
  return { name: target.name, ok: results.every((r) => r.ok), ms: Date.now() - started, checks: results, at: new Date().toISOString() };
}

async function alert(env, text) {
  const url = env && env.ALERT_WEBHOOK;
  if (!url) return false;
  const wecom = /qyapi\.weixin\.qq\.com/.test(url);
  const body = wecom ? { msgtype: 'text', text: { content: text } } : { msg_type: 'text', content: { text } };
  try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) }); return true; } catch (e) { return false; }
}

async function runChecks(env) {
  const targets = [];
  for (const t of TARGETS) targets.push(await check(t));
  const failed = targets.filter((r) => !r.ok);
  if (failed.length) {
    const lines = ['🚨 FRANK 服务异常 (' + new Date().toISOString() + ')'];
    for (const f of failed) lines.push(f.name + ': ' + f.checks.map((c) => c.path + ' -> ' + (c.status || c.error)).join(' | '));
    lines.push('后台: https://flutek-inbox.onrender.com');
    await alert(env, lines.join('\n'));
  }
  return { ok: !failed.length, checkedAt: new Date().toISOString(), targets };
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'flutek-uptime' });
    const summary = await runChecks(env);
    return Response.json({ service: 'flutek-uptime', cron: '*/10 * * * *', alertConfigured: Boolean(env && env.ALERT_WEBHOOK), ...summary },
      { headers: { 'cache-control': 'no-store' } });
  }
};
