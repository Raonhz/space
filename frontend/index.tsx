import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import StreamView from './StreamView.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// URL 경로 기반 라우팅: /stream → 유튜브 캡처 전용 뷰, 그 외 → 메인 사이트
const isStreamRoute = window.location.pathname === '/stream';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isStreamRoute ? <StreamView /> : <App />}
  </React.StrictMode>
);