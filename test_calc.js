// node test_calc.js — 외부 패키지 없이 실행. 실패하면 종료 코드 1.
const assert = require('assert');
const C = require('./calc.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

// 업무용 노트북(내장그래픽 · 대역폭 60GB/s · 16GB) 기준 설정
const LAPTOP = { vram: 0, bw: 60, tdp: 28, quant: 0.65, ram: 16, ctx: 4096 };
const model = (p) => ({ params: p });

t('실측 2건과 추정이 ±30% 이내', () => {
  for (const m of C.MEASURED) {
    const e = C.estimate(model(m.paramsB), LAPTOP);
    const err = Math.abs(e.tps - m.tps) / m.tps;
    assert.ok(err <= 0.30, `${m.model}: 추정 ${e.tps} vs 실측 ${m.tps} (오차 ${(err * 100).toFixed(0)}%)`);
  }
});

t('옛 계수(0.45)는 실측과 2배 차이였다 — 보정 후 그보다 낮아야 한다', () => {
  const e = C.estimate(model(2.5), LAPTOP);
  assert.ok(e.tps < 10, `추정 ${e.tps}`);
});

t('내장그래픽 16GB(가용 8GB): 14B급은 구동 불가, 7.8B는 구동되지만 5 t/s 미만', () => {
  const e = C.estimate(model(14.7), LAPTOP);   // 필요 약 10.4GB > 가용 8GB(16×0.5) → 구동 불가여야 함
  assert.strictEqual(e.mode, 'no');
  const e2 = C.estimate(model(7.8), LAPTOP);   // 필요 약 5.7GB ≤ 8GB
  assert.strictEqual(e2.mode, 'cpu');
  assert.ok(e2.tps < 5, `7.8B 추정 ${e2.tps}`);
});

t('RAM 가용 비율을 올리면 더 큰 모델이 구동 가능으로 바뀐다', () => {
  assert.strictEqual(C.estimate(model(14.7), Object.assign({}, LAPTOP, { ramShare: 0.65 })).mode, 'cpu');
  assert.strictEqual(C.estimate(model(14.7), LAPTOP).mode, 'no');
});

t('외장 GPU 에 들어가면 gpu, 넘치면 offload, 합쳐도 모자라면 no', () => {
  const g24 = { vram: 24, bw: 1008, tdp: 450, quant: 0.65, ram: 32, ctx: 4096 };
  assert.strictEqual(C.estimate(model(14), g24).mode, 'gpu');
  assert.strictEqual(C.estimate(model(32), g24).mode, 'gpu');       // 필요 ≈ 22GB ≤ 24GB
  assert.strictEqual(C.estimate(model(40), g24).mode, 'offload');   // 필요 ≈ 27GB, VRAM 24 + RAM 가용 16 = 40
  assert.strictEqual(C.estimate(model(70), g24).mode, 'no');        // 필요 ≈ 47GB > 40GB
});

t('offload 속도는 같은 모델이 GPU 에 다 들어갈 때보다 느리다 (시간 합산)', () => {
  const small = { vram: 8, bw: 272, tdp: 115, quant: 0.65, ram: 32, ctx: 4096 };
  const big = { vram: 24, bw: 272, tdp: 115, quant: 0.65, ram: 32, ctx: 4096 };
  const off = C.estimate(model(14.7), small);
  const full = C.estimate(model(14.7), big);
  assert.strictEqual(off.mode, 'offload');
  assert.strictEqual(full.mode, 'gpu');
  assert.ok(off.tps < full.tps, `offload ${off.tps} < gpu ${full.tps}`);
});

t('아주 작은 모델이 빠른 GPU에서도 상한(150 t/s)을 넘지 않는다', () => {
  const g = { vram: 24, bw: 1008, tdp: 450, quant: 0.65, ram: 32, ctx: 4096 };
  assert.ok(C.estimate(model(1.5), g).tps <= 150);
});

t('KV 캐시는 문맥 길이에 비례해 늘어난다', () => {
  assert.ok(Math.abs(C.kvCacheGB(8, 8192) - 1.2) < 1e-9);
  assert.ok(Math.abs(C.kvCacheGB(8, 16384) - 2.4) < 1e-9);
});

t('추천 모델: 노트북은 쓸 만한 속도(≥5 t/s) 중 가장 큰 모델, 없으면 null', () => {
  const r = C.pickBest(C.MODELS, LAPTOP);
  assert.ok(r.best && C.estimate(r.best, LAPTOP).tps >= 5, r.best && r.best.name);
  const none = C.pickBest(C.MODELS, Object.assign({}, LAPTOP, { ram: 2 }));
  assert.strictEqual(none.best, null);
});

t('전기요금: 28W·150원 → 4원/시간, 단가 입력이 반영된다', () => {
  assert.strictEqual(C.hourlyCostWon(28, 150), 4);
  assert.strictEqual(C.hourlyCostWon(600, 200), 120);
});

t('모델 목록: id 중복 없음, 홍보성 최상급 표현 없음', () => {
  const ids = C.MODELS.map((m) => m.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  const banned = /(최강|종결자|최고 추천|1위|o1 수준|GPT-4o|압도적|걸작|현존)/;
  for (const m of C.MODELS) assert.ok(!banned.test(m.desc + m.recommendedFor), m.name);
});

console.log(`\n${n}개 통과`);
