// node test_offline.js — 인터넷 없이 동작하는지(외부 자원·전송 코드가 없는지) 정적으로 확인한다.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const files = { 'index.html': html, 'app.js': fs.readFileSync('app.js', 'utf8'), 'calc.js': fs.readFileSync('calc.js', 'utf8') };
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

t('외부 스크립트·스타일·이미지 주소가 없다', () => {
  assert.ok(!/<(script|img|iframe)[^>]+src=["']https?:/i.test(html), 'src 에 외부 주소');
  assert.ok(!/<link[^>]+href=["']https?:/i.test(html), 'link 에 외부 주소');
  assert.ok(!/@import\s+url\(["']?https?:/i.test(html), 'CSS @import 외부 주소');
});
t('네트워크 호출 코드가 없다', () => {
  for (const [f, s] of Object.entries(files)) {
    assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(s.replace(/<style[\s\S]*?<\/style>/g, '')), f);
  }
});
t('개인 PC 사양·홍보 문구가 남아 있지 않다', () => {
  assert.ok(!/i[3579]-\d{4,5}[A-Z]*|Iris Xe|내 현재 PC|정식 출시|2026 최신/.test(html));
});
t('스크립트가 함께 있는 로컬 파일을 가리킨다', () => {
  assert.ok(html.includes('src="calc.js"') && html.includes('src="app.js"'));
});
t('외부 링크는 새 탭으로만 열리고 opener 를 넘기지 않는다', () => {
  const app = files['app.js'];
  const anchors = app.match(/<a href=[^>]*>/g) || [];
  assert.ok(anchors.length >= 3, '링크가 없음');
  for (const a of anchors) assert.ok(a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"'), a);
});
console.log(`\n${n}개 통과`);
