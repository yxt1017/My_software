(function () {
  'use strict';
  const find = id => document.getElementById(id);
  const endpoint = 'https://speed.cloudflare.com';
  const styles = [
    '.speed-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
    '.speed-stat{background:#0c2032;border:1px solid #284154;border-radius:13px;padding:15px;min-width:0}',
    '.speed-stat:first-child{background:linear-gradient(145deg,#153b48,#142a42);border-color:#39837e}',
    '.speed-stat small{display:block;color:#9db6c8;margin-bottom:6px;font-size:11px}',
    '.speed-stat b{color:#e7f7fc;font-size:clamp(15px,2.7vw,22px);word-break:break-word;font-variant-numeric:tabular-nums}',
    '.speed-stat:first-child b{color:#95ffe7}',
    '.speed-settings{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:18px 0 13px}',
    '.speed-settings select{background:#132b40;color:#daf2fa;border:1px solid #38576b;border-radius:11px;padding:11px;font:inherit;min-height:44px}',
    '.speed-settings label{color:#bacdda;font-size:12px;display:flex;align-items:center;gap:7px}',
    '.speed-settings input{accent-color:#72decf;width:17px;height:17px}',
    '.speed-buttons{display:flex;gap:9px;flex-wrap:wrap}',
    '.speed-progress{height:7px;border-radius:9px;background:#1c3449;margin-top:17px;overflow:hidden}',
    '.speed-progress>div{height:100%;width:0;background:linear-gradient(90deg,#72dfcf,#7daaff);transition:width .16s}',
    '.speed-sub{display:flex;align-items:start;justify-content:space-between;gap:14px;margin-top:10px;color:#a9bdcf;font-size:12px}',
    '.speed-units{color:#a5dfdc;background:#112b3c;border:1px solid #26505b;border-radius:10px;padding:11px;font-size:12px;line-height:1.7;margin-top:13px;font-variant-numeric:tabular-nums}',
    '@media(max-width:700px){.speed-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.speed-stat b{font-size:18px}.speed-buttons .btn{flex:1}}'
  ].join('');
  document.head.insertAdjacentHTML('beforeend', '<style>' + styles + '</style>');
  const markup = [
    '<div class="section-title"><h2>网络测速</h2><span class="hint">真实流量测试 · 手动启动</span></div>',
    '<section class="panel" aria-label="节点网络测速">',
    '<p class="panel-description">检测当前线路到 Cloudflare 的网络速度。白鲸智能分流可能让测速与 Gemini 使用不同出口。</p>',
    '<div class="speed-stats">',
    '<div class="speed-stat"><small>下载速度</small><b id="spd-down">—</b></div>',
    '<div class="speed-stat"><small>上传速度</small><b id="spd-up">—</b></div>',
    '<div class="speed-stat"><small>延迟</small><b id="spd-ping">—</b></div>',
    '<div class="speed-stat"><small>本次数据量</small><b id="spd-data">0 MB</b></div>',
    '</div>',
    '<div class="speed-settings">',
    '<select id="spd-size" aria-label="下载测速大小"><option value="2">轻量测速 · 2 MB</option><option value="10" selected>标准测速 · 10 MB</option><option value="25">深入测速 · 25 MB</option></select>',
    '<label><input id="spd-upload" type="checkbox">同时测试上传（额外流量）</label>',
    '</div>',
    '<div class="speed-buttons"><button class="btn btn-primary" id="spd-start" type="button">▶ 开始测速</button>',
    '<button class="btn" id="spd-stop" disabled type="button">停止测速</button>',
    '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://speed.cloudflare.com/">Cloudflare 官方测速 ↗</a></div>',
    '<div class="speed-progress" role="progressbar" aria-label="下载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="spd-progress"><div id="spd-bar"></div></div>',
    '<div class="speed-sub"><span id="spd-status" role="status" aria-live="polite">准备就绪。测速不会自动启动，也不会在后台消耗流量。</span><span id="spd-pct">0%</span></div>',
    '<div class="speed-units" id="spd-units">完成后显示 Kb/s、KB/s、MB/s、Mbps 四种单位的速度。</div>',
    '<p class="micro">1 MB = 1000 KB，1 Byte = 8 bit。标准测试下载约 10 MB；开启上传另需约 2 MB。实际消耗包含少量协议开销。测速失败可能与节点分流或跨域限制有关，并不代表所有网站无法访问。</p>',
    '</section>'
  ].join('');
  const geminiPanel = document.querySelector('.ai-box');
  const anchor = geminiPanel && geminiPanel.previousElementSibling;
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', markup);
  const $ = find;
  let active = null, received = 0;
  const num = (v, digits=2) => Number.isFinite(v) ? v.toFixed(digits) : '—';
  function setStatus(s) { $('spd-status').textContent = s; }
  function setProgress(v) {
    const n = Math.max(0, Math.min(100, Math.round(v)));
    $('spd-bar').style.width = n + '%';
    $('spd-pct').textContent = n + '%';
    $('spd-progress').setAttribute('aria-valuenow', String(n));
  }
  function showRate(element, bytesPerSecond) {
    element.textContent = bytesPerSecond >= 1000000
      ? num(bytesPerSecond / 1000000) + ' MB/s'
      : num(bytesPerSecond / 1000, 1) + ' KB/s';
  }
  function showDownload(bytesPerSecond) {
    showRate($('spd-down'), bytesPerSecond);
    $('spd-units').textContent = '下载换算：' +
      num(bytesPerSecond * 8 / 1000, 1) + ' Kb/s · ' +
      num(bytesPerSecond / 1000, 1) + ' KB/s · ' +
      num(bytesPerSecond / 1000000) + ' MB/s · ' +
      num(bytesPerSecond * 8 / 1000000) + ' Mbps';
  }
  function addData(bytes) {
    received += bytes;
    $('spd-data').textContent = num(received / 1000000) + ' MB';
  }
  function url(bytes) {
    return endpoint + '/__down?bytes=' + bytes + '&_=' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  async function testLatency(signal) {
    let results = [];
    for (let i=0; i<3; i++) {
      const start = performance.now();
      const r = await fetch(url(0), {signal: signal, mode:'cors', credentials:'omit', cache:'no-store'});
      if (!r.ok) throw Error('延迟请求 HTTP ' + r.status);
      await r.arrayBuffer();
      results.push(performance.now() - start);
    }
    results.sort((a,b) => a-b);
    $('spd-ping').textContent = num(results[1], 0) + ' ms';
  }
  async function testDownload(size, signal) {
    const bytes = size * 1000000, start = performance.now();
    const r = await fetch(url(bytes), {signal: signal, mode:'cors', credentials:'omit', cache:'no-store'});
    if (!r.ok) throw Error('下载请求 HTTP ' + r.status);
    let count=0, lastUpdate=0;
    if (r.body && r.body.getReader) {
      const reader = r.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (!chunk.value) continue;
        count += chunk.value.byteLength;
        addData(chunk.value.byteLength);
        setProgress(100 * count / bytes);
        const now = performance.now();
        if (now - lastUpdate > 220 && now - start > 180) {
          showDownload(count * 1000 / (now - start));
          lastUpdate = now;
        }
      }
    } else {
      const buffer = await r.arrayBuffer();
      count = buffer.byteLength;
      addData(count);
    }
    if (count < bytes * .85) throw Error('测速文件数据不足，无法得到准确结果');
    showDownload(count * 1000 / Math.max(performance.now() - start, 1));
    setProgress(100);
  }
  async function testUpload(bytes, signal) {
    setStatus('正在上传测试数据…');
    const data = new Uint8Array(bytes);
    const t0 = performance.now();
    const r = await fetch(endpoint + '/__up?test=' + Date.now(),
      {method:'POST', mode:'cors', credentials:'omit', cache:'no-store', signal:signal,
       headers:{'Content-Type':'application/octet-stream'}, body:data});
    if (!r.ok) throw Error('上传请求 HTTP ' + r.status);
    await r.arrayBuffer();
    addData(bytes);
    showRate($('spd-up'), bytes * 1000 / Math.max(performance.now() - t0, 1));
  }
  async function run() {
    if (active) return;
    const size = Number($('spd-size').value);
    const wantUp = $('spd-upload').checked;
    const state = {controller:new AbortController(), cancelled:false, timedOut:false};
    active = state; received = 0;
    $('spd-start').disabled = true;
    $('spd-stop').disabled = false;
    $('spd-size').disabled = true;
    $('spd-upload').disabled = true;
    $('spd-down').textContent = '—';
    $('spd-up').textContent = wantUp ? '等待中' : '未启用';
    $('spd-ping').textContent = '—';
    $('spd-data').textContent = '0 MB';
    $('spd-units').textContent = '正在测量实际传输速度…';
    setProgress(0);
    const timeout = setTimeout(() => { state.timedOut = true; state.controller.abort(); }, 90000);
    try {
      setStatus('正在测试网络延迟…');
      try { await testLatency(state.controller.signal); }
      catch(e) {
        if (state.controller.signal.aborted) throw e;
        $('spd-ping').textContent = '无法检测';
      }
      setStatus('正在下载 ' + size + ' MB 测试数据…');
      await testDownload(size, state.controller.signal);
      if (wantUp) {
        try { await testUpload((size===2?1:size===25?5:2)*1000000, state.controller.signal); }
        catch(e) {
          if (state.controller.signal.aborted) throw e;
          $('spd-up').textContent='失败';
          setStatus('下载已完成；上传失败：' + (e.message || '跨域或网络错误') + '。');
          return;
        }
      }
      setStatus('测速完成。可切换白鲸节点后再次测试。');
    } catch(e) {
      if (state.cancelled) setStatus('已停止，本次测速结果不完整。');
      else if (state.timedOut) setStatus('超过 90 秒，已停止。建议改用轻量测速。');
      else setStatus('测速失败：' + (e.message || '无法访问测速服务') + '。可使用官方测速入口。');
    } finally {
      clearTimeout(timeout);
      active = null;
      $('spd-start').disabled = false;
      $('spd-stop').disabled = true;
      $('spd-size').disabled = false;
      $('spd-upload').disabled = false;
    }
  }
  $('spd-start').addEventListener('click', run);
  $('spd-stop').addEventListener('click', () => {
    if (!active) return;
    active.cancelled = true;
    active.controller.abort();
    setStatus('正在停止…');
  });
})();