# 🖥️ 로컬 LLM 내 PC 맞춤 구동 계산기 (Local LLM Custom PC Calculator)

> 내 컴퓨터 사양(GPU/VRAM/RAM)을 바탕으로 구동 가능한 최적의 오픈소스 AI 모델(DeepSeek-R1, EXAONE 3.5, Qwen 2.5, Llama 3)과 예상 토큰 생성 속도(t/s), 전력 효율 및 예상 전기세를 즉시 산출하는 웹 도구입니다.

---

## ✨ 주요 기능
- **최신 2026 하드웨어 프리셋 지원**:
  - NVIDIA GeForce RTX 50 시리즈 (RTX 5090, 5080, 5070 Ti, 5070)
  - NVIDIA GeForce RTX 40 / 30 시리즈
  - AMD Radeon RX 7000 시리즈
  - Apple Silicon 통합 메모리 Mac (M1/M2/M3/M4, Pro, Max, Ultra)
  - Intel Arc 및 내장 그래픽 (CPU + RAM 구동)
- **최신 AI 모델 라인업 탑재**:
  - 🇰🇷 **한국어 특화**: LG AI연구원 EXAONE 3.5 (2.4B, 7.8B, 32B)
  - 🧠 **심층 추론**: DeepSeek-R1 Distill (1.5B, 8B, 14B, 32B, 70B)
  - 💻 **코딩 & 실무**: Qwen 2.5 Coder & 범용 모델 (7B, 14B, 32B)
  - 🌐 **글로벌 표준**: Meta Llama 3.2/3.3, Google Gemma 2
- **정밀한 메모리 오버헤드 산출**:
  - 모델 가중치(양자화 Q4_K_M, Q5, Q8) + KV 캐시(문맥 길이 4K/8K/16K/32K)를 반영한 실시간 VRAM 점유율 계산
- **원클릭 공유 & 기기 감지**:
  - 브라우저 WebGL 기반 접속 기기 그래픽카드 자동 감지
  - 결과 파라미터 URL 원클릭 복사 & SNS 공유
  - 터미널 Ollama 원클릭 실행 명령어 복사

---

## 🚀 로컬 실행 방법
별도의 빌드 과정 없이 `index.html` 파일을 브라우저로 열기만 하면 즉시 작동합니다.
```bash
# 브라우저로 바로 실행
start index.html
```

---

## 📄 라이선스
MIT License
