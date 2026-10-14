import os
import sys
import webview

def get_html_path():
    # PyInstaller 임시 추출 경로(_MEIPASS) 또는 로컬 경로 감지
    if hasattr(sys, '_MEIPASS'):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, 'index.html')

def main():
    html_file = get_html_path()
    if not os.path.exists(html_file):
        print(f"Error: index.html not found at {html_file}")
        sys.exit(1)

    # 네이티브 데스크톱 앱 윈도우 생성
    window = webview.create_window(
        title="로컬 LLM 내 PC 맞춤 계산기 | AI 모델 구동 성능 & 속도 예측",
        url=f"file:///{os.path.abspath(html_file).replace(os.sep, '/')}",
        width=1240,
        height=860,
        min_size=(960, 640),
        resizable=True,
        text_select=True,
        zoomable=True
    )

    # GUI 이벤트 루프 실행 (Edge Chromium WebView2 엔진 사용)
    webview.start(gui='edgechromium', debug=False)

if __name__ == '__main__':
    main()
