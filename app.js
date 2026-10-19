/* 화면 로직 — 계산은 calc.js(LLMCalc)가 한다. 외부 통신 없음. */
/* 아래 클래스는 상태 색상을 문자열 조합으로 만들기 때문에 CSS 생성기가 놓치지 않도록 적어 둔다.
   bg-emerald-500/10 text-emerald-400 border-emerald-500/30
   bg-amber-500/10 text-amber-400 border-amber-500/30
   bg-rose-500/10 text-rose-400 border-rose-500/30 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const gpuPreset = $('gpuPreset'), quantLevel = $('quantLevel'), sysRam = $('sysRam'), ramShare = $('ramShare');
  const vramSlider = $('vramSlider'), bwSlider = $('bwSlider'), tdpSlider = $('tdpSlider'), ctxSelect = $('ctxSelect');
  const kwhPrice = $('kwhPrice'), customParams = $('customParams');
  const tableBody = $('modelTableBody'), summaryBanner = $('summaryBanner');
  let currentCategory = 'all';

  const num = (el, fallback) => { const v = Number(el.value); return Number.isFinite(v) ? v : fallback; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function config() {
    return {
      vram: num(vramSlider, 0), bw: num(bwSlider, 60), tdp: num(tdpSlider, 28), quant: num(quantLevel, 0.65),
      ram: num(sysRam, 16), ctx: num(ctxSelect, 4096), ramShare: num(ramShare, 0.5),
    };
  }

  function statusOf(e) {
    if (e.mode === 'gpu') return ['쾌적 구동 (VRAM에 모두 올라감)', 'emerald'];
    if (e.mode === 'cpu') {
      if (e.tps >= 8) return ['내장/CPU 구동 (원활)', 'emerald'];
      if (e.tps >= 5) return ['내장/CPU 구동 (다소 느림)', 'amber'];
      return ['내장/CPU 구동 (매우 느림)', 'amber'];
    }
    if (e.mode === 'offload') return ['부분 오프로딩 (일부 RAM 사용, 속도 저하)', 'amber'];
    return ['구동 불가 (메모리 부족)', 'rose'];
  }

  // 모델 이름 아래 공식 페이지 링크 (누를 때만 인터넷 사용)
  function links(m) {
    const a = [];
    if (m.official) a.push(`<a href="${esc(m.official)}" target="_blank" rel="noopener noreferrer" class="ext-link">공식 페이지 ↗</a>`);
    if (m.ollama) a.push(`<a href="${esc(m.ollama)}" target="_blank" rel="noopener noreferrer" class="ext-link">Ollama 페이지 ↗</a>`);
    return a.length ? `<div class="text-[11px] text-slate-400 mt-1 flex gap-3">${a.join('')}</div>` : '';
  }

  function row(m, e, tdp, isBest) {
    const [status, tone] = statusOf(e);
    const badge = `bg-${tone}-500/10 text-${tone}-400 border-${tone}-500/30`;
    const bar = e.mode === 'no' ? 'bg-rose-500' : (tone === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400');
    const speedCls = e.tps >= 20 ? 'text-indigo-400' : e.tps >= 8 ? 'text-emerald-400' : e.tps > 0 ? 'text-amber-400' : 'text-slate-600';
    const speedTxt = e.tps >= 20 ? '빠름' : e.tps >= 8 ? '원활' : e.tps >= 5 ? '다소 느림' : e.tps > 0 ? '답을 기다리는 느낌' : '메모리 부족';
    const where = e.mode === 'cpu' ? '가용 RAM' : 'VRAM';
    return `
      <tr class="hover:bg-slate-800/40 ${isBest ? 'bg-indigo-950/20' : ''}">
        <td class="py-4 px-4">
          <div class="flex items-center gap-2 flex-wrap">
            ${m.official ? `<a href="${esc(m.official)}" target="_blank" rel="noopener noreferrer" title="개발사 공식 페이지 열기" class="font-bold text-white text-base ext-link">${esc(m.name)}</a>` : `<span class="font-bold text-white text-base">${esc(m.name)}</span>`}
            <span class="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-700/40 text-slate-300 border border-slate-600/30">${esc(m.categoryLabel)}</span>
            ${isBest ? '<span class="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-md">추천</span>' : ''}
          </div>
          <div class="text-xs text-slate-400 mt-1 leading-normal">${esc(m.desc)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">쓰임새: ${esc(m.recommendedFor)}</div>
          ${links(m)}
        </td>
        <td class="py-4 px-3 font-mono">
          <div class="text-slate-200 font-bold text-sm">${e.req} GB</div>
          <div class="text-[10px] text-slate-500 mt-0.5">가중치 ${e.weight}G + KV ${e.kv}G</div>
        </td>
        <td class="py-4 px-3">
          <div class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${badge}">${esc(status)}</div>
          <div class="w-32 bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden"><div class="${bar} h-1.5 rounded-full" style="width: ${e.usedPct}%"></div></div>
          <div class="text-[10px] text-slate-500 mt-0.5 font-mono">${where} ${e.usedPct}% 사용</div>
        </td>
        <td class="py-4 px-3 whitespace-nowrap">
          <div class="font-bold font-mono text-base ${speedCls}">${e.tps > 0 ? `약 ${e.tps} t/s` : '구동 불가'}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${speedTxt}</div>
        </td>
        <td class="py-4 px-3 text-xs text-slate-300 font-mono whitespace-nowrap">
          ${e.tps > 0 ? `<div class="text-indigo-300 font-medium">${(e.tps / tdp).toFixed(2)} t/W</div><div class="text-slate-500 text-[11px] mt-0.5">최대 약 ${tdp}W</div>` : '<span class="text-slate-600">-</span>'}
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center gap-1.5 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <code class="text-xs text-indigo-300 font-mono select-all truncate max-w-[190px]">${esc(m.cmd)}</code>
            <button data-cmd="${esc(m.cmd)}" class="copy-btn text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded flex-shrink-0 cursor-pointer">복사</button>
          </div>
        </td>
      </tr>`;
  }

  function calculate() {
    const c = config();
    $('vramVal').textContent = `${c.vram} GB`;
    $('bwVal').textContent = `${c.bw} GB/s`;
    $('tdpVal').textContent = `${c.tdp} W`;
    $('ctxVal').textContent = `${c.ctx >= 1024 ? c.ctx / 1024 + 'K' : c.ctx} 토큰`;

    const price = Math.max(0, num(kwhPrice, 150));
    const custom = Number(customParams.value);
    const list = LLMCalc.MODELS.slice();
    if (Number.isFinite(custom) && custom >= 0.1 && custom <= 1000) {
      list.unshift({ id: 'custom', name: `직접 입력 ${custom}B`, category: 'custom', categoryLabel: '직접 입력', params: custom,
        desc: '입력한 크기로 같은 방식으로 계산한 값', cmd: 'ollama run <모델이름>', recommendedFor: '-' });
    }
    const { best, maxTps } = LLMCalc.pickBest(list, c);
    const shown = list.filter((m) => currentCategory === 'all' || m.category === currentCategory || m.id === 'custom');
    tableBody.innerHTML = shown.map((m) => row(m, LLMCalc.estimate(m, c), c.tdp, best && best.id === m.id)).join('');

    const bestName = best ? best.name : '없음';
    const bestDesc = best
      ? (c.vram > 0 ? `VRAM ${c.vram}GB 안에 모두 올라가는 가장 큰 모델` : '내장그래픽/CPU로 5 t/s 이상 나오는 가장 큰 모델')
      : '이 설정에서는 쓸 만한 속도로 돌릴 모델이 없습니다.';
    const cost = LLMCalc.hourlyCostWon(c.tdp, price);
    summaryBanner.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div class="text-xs font-semibold text-emerald-400 mb-1">추천 모델 (이 설정 기준)</div>
        <div class="text-xl font-extrabold text-white mt-1 truncate">${best && best.official ? `<a href="${esc(best.official)}" target="_blank" rel="noopener noreferrer" title="개발사 공식 페이지 열기" class="ext-link">${esc(bestName)}</a>` : esc(bestName)}</div>
        <div class="text-xs text-slate-400 mt-1.5 leading-relaxed">${esc(bestDesc)}</div>
        ${best ? links(best) : ''}
      </div>
      <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div class="text-xs font-semibold text-indigo-400 mb-1">가장 빠른 모델의 예상 속도</div>
        <div class="text-xl font-extrabold text-white mt-1 font-mono">${maxTps > 0 ? `초당 약 ${maxTps} 토큰` : '구동 불가'}</div>
        <div class="text-xs text-slate-400 mt-1.5 leading-relaxed">추정치입니다. 실제 PC에서 잰 값과 최대 2배쯤 다를 수 있습니다.</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div class="text-xs font-semibold text-amber-400 mb-1">1시간 최대 부하 시 전기요금(상한)</div>
        <div class="text-xl font-extrabold text-white mt-1 font-mono">약 ${cost}원 <span class="text-xs text-slate-400 font-normal">/ 시간</span></div>
        <div class="text-xs text-slate-400 mt-1.5 leading-relaxed">최대 전력 ${c.tdp}W를 계속 쓴다고 가정, 단가 ${price}원/kWh</div>
      </div>`;
  }

  // --- 이벤트
  document.querySelectorAll('.cat-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach((b) => { b.classList.remove('bg-indigo-600', 'text-white', 'shadow'); b.classList.add('text-slate-400'); });
    btn.classList.add('bg-indigo-600', 'text-white', 'shadow'); btn.classList.remove('text-slate-400');
    currentCategory = btn.dataset.cat; calculate();
  }));

  gpuPreset.addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
      const [vram, bw, tdp] = e.target.value.split(',').map(Number);
      vramSlider.value = vram; bwSlider.value = bw; tdpSlider.value = tdp; calculate();
    }
  });

  [quantLevel, sysRam, ramShare, vramSlider, bwSlider, tdpSlider, ctxSelect, kwhPrice, customParams].forEach((el) =>
    el.addEventListener('input', (e) => {
      if (['vramSlider', 'bwSlider', 'tdpSlider'].includes(e.target.id)) gpuPreset.value = 'custom';
      calculate();
    }));

  $('applyLaptopBtn').addEventListener('click', () => {
    gpuPreset.value = '0,60,28';
    vramSlider.value = 0; bwSlider.value = 60; tdpSlider.value = 28;
    sysRam.value = '16'; quantLevel.value = '0.65'; ctxSelect.value = '4096'; ramShare.value = '0.5';
    calculate();
  });

  tableBody.addEventListener('click', (e) => {
    const b = e.target.closest('.copy-btn');
    if (b) copyText(b.dataset.cmd, b, '복사');
  });

  function copyText(text, btn, label) {
    const done = () => { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = label; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    else fallback();
    function fallback() {
      const t = document.createElement('input'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* 복사 불가 환경 */ }
      document.body.removeChild(t);
    }
  }

  window.shareConfig = function (btn) {
    const p = new URLSearchParams({ vram: vramSlider.value, bw: bwSlider.value, tdp: tdpSlider.value, ram: sysRam.value,
      ctx: ctxSelect.value, q: quantLevel.value, share: ramShare.value, kwh: kwhPrice.value });
    copyText(`${location.origin === 'null' ? '' : location.origin}${location.pathname}?${p}`, btn, '🔗 결과 링크 공유');
  };

  // 브라우저가 알려 주는 그래픽 장치 이름(참고용). 화면에는 textContent 로만 넣는다.
  function detectClientGpu() {
    const badge = $('detectedGpuName');
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const raw = ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (raw) {
        const ram = navigator.deviceMemory ? ` · 브라우저가 알려 주는 RAM 약 ${navigator.deviceMemory}GB` : '';
        badge.textContent = String(raw).replace(/^ANGLE \(([^,]*), ([^,]*),.*\)$/, '$2').replace(/\s*\(0x[0-9A-Fa-f]+\)/g, '').replace(/\s*Direct3D\S*.*$/, '').trim().slice(0, 80) + ram;
        return;
      }
    } catch (_) { /* 감지 실패 */ }
    badge.textContent = '알 수 없음 (브라우저가 알려 주지 않음)';
  }

  // 링크 파라미터는 숫자만, 허용 범위 안에서만 받는다.
  function loadFromUrlParams() {
    const q = new URLSearchParams(location.search);
    const set = (key, el, lo, hi) => {
      if (!q.has(key)) return false;
      const v = Number(q.get(key));
      if (!Number.isFinite(v) || v < lo || v > hi) return false;
      el.value = v; return el.value !== '' ;
    };
    let loaded = false;
    loaded = set('vram', vramSlider, 0, 128) || loaded;
    loaded = set('bw', bwSlider, 40, 2000) || loaded;
    loaded = set('tdp', tdpSlider, 20, 650) || loaded;
    loaded = set('kwh', kwhPrice, 0, 1000) || loaded;
    for (const [key, el] of [['ram', sysRam], ['ctx', ctxSelect], ['q', quantLevel], ['share', ramShare]]) {
      if (q.has(key) && [...el.options].some((o) => o.value === q.get(key))) { el.value = q.get(key); loaded = true; }
    }
    if (loaded) gpuPreset.value = 'custom';
  }

  detectClientGpu();
  loadFromUrlParams();
  calculate();
})();
