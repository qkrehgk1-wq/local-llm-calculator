/* 로컬 LLM 구동 추정 — 계산 로직 (화면과 분리해 node 로 시험할 수 있게 했다)
 *
 * 속도 추정: 한 토큰을 만들 때 모델 가중치 전체를 메모리에서 한 번 읽으므로
 *   t/s ≈ (메모리 대역폭 × 효율) ÷ 모델이 차지하는 메모리(GB)
 * 효율 계수
 *   · 내장그래픽/CPU 0.20 — 이 값은 실측으로 맞췄다(아래 MEASURED 참고).
 *   · 외장 GPU 0.68 — 실측 없음(일반적으로 알려진 범위의 값). 참고용으로만 본다.
 * 모든 값은 추정치이며 실제와 다를 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LLMCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 실측(2026-10-13, Ollama /api/generate 의 eval_count/eval_duration, 12세대 Core i5(U 시리즈) · 내장그래픽 · RAM 약 16GB 노트북)
  const MEASURED = [
    { model: 'gemma:2b', paramsB: 2.5, tps: 7.0 },
    { model: 'qwen3.5:2b', paramsB: 2.0, tps: 6.5 },
  ];

  const DEFAULTS = {
    effGpu: 0.68,     // 외장 GPU (실측 없음)
    effCpu: 0.20,     // 내장그래픽·CPU (실측으로 보정)
    sysBw: 48,        // 외장 GPU 로 모자라 RAM 으로 넘길 때 시스템 메모리 대역폭(GB/s)
    ramShare: 0.5,    // 전체 RAM 중 모델에 쓸 수 있는 비율(업무 프로그램을 켜 둔 상태)
    usableTps: 5,     // 이 속도 이상이면 '쓸 만하다'로 추천 후보에 넣는다
    tpsCap: 150,      // 소형 모델은 대역폭이 아니라 연산·호출 오버헤드가 한계라 수백 t/s 는 나오지 않는다(경험적 상한, 실측 없음)
  };

  const MODELS = [
    { id: 'exaone-2.4b', name: 'EXAONE 3.5 2.4B', category: 'korean', categoryLabel: '한국어', params: 2.4,
      desc: 'LG AI연구원 공개 모델(한국어·영어). 가장 가벼운 크기', cmd: 'ollama run exaone3.5:2.4b',
      recommendedFor: '짧은 요약, 키워드 추출' },
    { id: 'exaone-7.8b', name: 'EXAONE 3.5 7.8B', category: 'korean', categoryLabel: '한국어', params: 7.8,
      desc: 'LG AI연구원 공개 모델. 중간 크기', cmd: 'ollama run exaone3.5:7.8b',
      recommendedFor: '한국어 문서 초안, 번역 보조' },
    { id: 'exaone-32b', name: 'EXAONE 3.5 32B', category: 'korean', categoryLabel: '한국어', params: 32,
      desc: 'LG AI연구원 공개 모델. 가장 큰 크기(고사양 필요)', cmd: 'ollama run exaone3.5:32b',
      recommendedFor: '긴 문서 분석' },

    { id: 'deepseek-r1-1.5b', name: 'DeepSeek-R1 Distill 1.5B', category: 'reasoning', categoryLabel: '추론', params: 1.5,
      desc: '답하기 전에 생각 과정(<think>)을 출력하는 증류 모델', cmd: 'ollama run deepseek-r1:1.5b',
      recommendedFor: '단순 논리 시험용' },
    { id: 'deepseek-r1-8b', name: 'DeepSeek-R1 Distill 8B', category: 'reasoning', categoryLabel: '추론', params: 8,
      desc: 'Llama 3.1 기반 증류 모델', cmd: 'ollama run deepseek-r1:8b',
      recommendedFor: '단계별 풀이가 필요한 문제' },
    { id: 'deepseek-r1-14b', name: 'DeepSeek-R1 Distill 14B', category: 'reasoning', categoryLabel: '추론', params: 14,
      desc: 'Qwen 2.5 기반 증류 모델', cmd: 'ollama run deepseek-r1:14b',
      recommendedFor: '코드·논리 검토' },
    { id: 'deepseek-r1-32b', name: 'DeepSeek-R1 Distill 32B', category: 'reasoning', categoryLabel: '추론', params: 32,
      desc: 'Qwen 2.5 기반 증류 모델(고사양 필요)', cmd: 'ollama run deepseek-r1:32b',
      recommendedFor: '복잡한 추론' },
    { id: 'deepseek-r1-70b', name: 'DeepSeek-R1 Distill 70B', category: 'reasoning', categoryLabel: '추론', params: 70,
      desc: 'Llama 3.3 기반 증류 모델. 큰 메모리(듀얼 GPU·대용량 통합메모리) 필요', cmd: 'ollama run deepseek-r1:70b',
      recommendedFor: '가장 큰 추론 모델' },

    { id: 'qwen-coder-7b', name: 'Qwen 2.5 Coder 7B', category: 'coding', categoryLabel: '코딩·실무', params: 7.6,
      desc: '코드 작성·수정에 맞춘 모델', cmd: 'ollama run qwen2.5-coder:7b',
      recommendedFor: '코드 자동완성, 버그 수정 보조' },
    { id: 'qwen-coder-14b', name: 'Qwen 2.5 Coder 14B', category: 'coding', categoryLabel: '코딩·실무', params: 14.7,
      desc: '코드 작성·수정에 맞춘 중형 모델', cmd: 'ollama run qwen2.5-coder:14b',
      recommendedFor: '조금 큰 코드 작업' },
    { id: 'qwen-14b', name: 'Qwen 2.5 14B (범용)', category: 'coding', categoryLabel: '코딩·실무', params: 14.7,
      desc: '다국어 범용 모델', cmd: 'ollama run qwen2.5:14b',
      recommendedFor: '문서 번역, 데이터 정리' },
    { id: 'qwen-32b', name: 'Qwen 2.5 32B (범용)', category: 'coding', categoryLabel: '코딩·실무', params: 32.5,
      desc: '다국어 범용 대형 모델(고사양 필요)', cmd: 'ollama run qwen2.5:32b',
      recommendedFor: '사내 서버·고성능 PC용' },

    { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', category: 'standard', categoryLabel: '글로벌', params: 3.2,
      desc: 'Meta 경량 모델', cmd: 'ollama run llama3.2:3b', recommendedFor: '짧은 대화, 분류' },
    { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'standard', categoryLabel: '글로벌', params: 8.0,
      desc: 'Meta 중형 모델. 호환되는 도구가 많음', cmd: 'ollama run llama3.1:8b', recommendedFor: '일반 업무 보조' },
    { id: 'gemma-2-9b', name: 'Gemma 2 9B', category: 'standard', categoryLabel: '글로벌', params: 9.2,
      desc: 'Google 중형 모델', cmd: 'ollama run gemma2:9b', recommendedFor: '글 다듬기, 요약' },
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'standard', categoryLabel: '글로벌', params: 70.6,
      desc: 'Meta 대형 모델(큰 메모리 필요)', cmd: 'ollama run llama3.3:70b', recommendedFor: '고사양 서버용' },
  ];

  // 모델별 공식 페이지: 개발사가 공개한 모델 카드(Hugging Face). Ollama 페이지는 실행 명령에서 만든다.
  // 링크는 사용자가 누를 때만 열린다(계산기 자체는 인터넷 없이 동작).
  const OFFICIAL = {
    'exaone-2.4b': 'https://huggingface.co/LGAI-EXAONE/EXAONE-3.5-2.4B-Instruct',
    'exaone-7.8b': 'https://huggingface.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct',
    'exaone-32b': 'https://huggingface.co/LGAI-EXAONE/EXAONE-3.5-32B-Instruct',
    'deepseek-r1-1.5b': 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
    'deepseek-r1-8b': 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
    'deepseek-r1-14b': 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
    'deepseek-r1-32b': 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
    'deepseek-r1-70b': 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
    'qwen-coder-7b': 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct',
    'qwen-coder-14b': 'https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct',
    'qwen-14b': 'https://huggingface.co/Qwen/Qwen2.5-14B-Instruct',
    'qwen-32b': 'https://huggingface.co/Qwen/Qwen2.5-32B-Instruct',
    'llama-3.2-3b': 'https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct',
    'llama-3.1-8b': 'https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct',
    'gemma-2-9b': 'https://huggingface.co/google/gemma-2-9b-it',
    'llama-3.3-70b': 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct',
  };
  for (const m of MODELS) {
    m.official = OFFICIAL[m.id] || '';
    const tag = /^ollama run ([a-z0-9.\-]+)(?::|$)/.exec(m.cmd);
    m.ollama = tag ? `https://ollama.com/library/${tag[1]}` : '';
  }

  // KV 캐시 근사: 문맥 8K 에서 8B 모델 기준 약 1.2GB, 모델 크기의 제곱근에 비례한다고 단순화.
  // 실제는 모델 구조(층 수, KV 헤드 수)에 따라 다르므로 ±수십 % 오차가 있다.
  function kvCacheGB(paramsB, ctxTokens) {
    return (ctxTokens / 8192) * 1.2 * Math.sqrt(paramsB / 8);
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  // cfg: { vram, bw, tdp, quant, ram, ctx, ramShare?, effGpu?, effCpu?, sysBw? }
  function estimate(model, cfg) {
    const c = Object.assign({}, DEFAULTS, cfg);
    const kv = round1(kvCacheGB(model.params, c.ctx));
    const weight = round1(model.params * c.quant);
    const req = round1(weight + kv);
    const usableRam = round1(c.ram * c.ramShare);
    const out = { kv, weight, req, tps: 0, mode: 'no', usedPct: 100 };

    if (c.vram > 0 && c.vram >= req) {
      out.mode = 'gpu';
      out.tps = (c.bw * c.effGpu) / req;
      out.usedPct = Math.round((req / c.vram) * 100);
    } else if (c.vram === 0 && usableRam >= req) {
      out.mode = 'cpu';
      out.tps = (c.bw * c.effCpu) / req;
      out.usedPct = Math.round((req / usableRam) * 100);
    } else if (c.vram > 0 && c.vram + usableRam >= req) {
      // 일부는 GPU, 나머지는 시스템 RAM: 토큰 하나당 걸리는 시간을 더해서 계산한다
      out.mode = 'offload';
      const g = c.vram / req;
      const secPerGB = g / (c.bw * c.effGpu) + (1 - g) / (c.sysBw * c.effCpu);
      out.tps = 1 / (req * secPerGB);
      out.usedPct = 100;
    }
    out.tps = out.tps > 0 ? Math.max(0.1, round1(Math.min(out.tps, c.tpsCap))) : 0;
    return out;
  }

  // 추천: 외장 GPU 에 통째로 들어가는 가장 큰 모델, 없으면(내장 포함) 쓸 만한 속도가 나오는 가장 큰 모델
  function pickBest(models, cfg) {
    const c = Object.assign({}, DEFAULTS, cfg);
    let best = null, maxTps = 0;
    for (const m of models) {
      const e = estimate(m, c);
      if (e.tps > maxTps) maxTps = e.tps;
      const ok = e.mode === 'gpu' || (e.mode === 'cpu' && e.tps >= c.usableTps);
      if (ok && (!best || m.params > best.params)) best = m;
    }
    return { best, maxTps };
  }

  function hourlyCostWon(tdpW, wonPerKwh) {
    return Math.round((tdpW / 1000) * wonPerKwh);
  }

  return { MODELS, MEASURED, DEFAULTS, kvCacheGB, estimate, pickBest, hourlyCostWon };
});
