import { Metadata } from 'next';
import ClientHome from '../ClientHome';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = 'https://space.raondr.com';
  const alternates = {
    canonical: `${baseUrl}/${lang}/stream`,
    languages: {
      'en': `${baseUrl}/en/stream`,
      'ko': `${baseUrl}/ko/stream`,
      'ja': `${baseUrl}/ja/stream`,
      'zh': `${baseUrl}/zh/stream`,
      'es': `${baseUrl}/es/stream`,
      'fr': `${baseUrl}/fr/stream`,
      'de': `${baseUrl}/de/stream`,
      'pt': `${baseUrl}/pt/stream`,
      'x-default': `${baseUrl}/en/stream`,
    },
  };
  
  if (lang === 'ko') {
    return {
      title: "ISS 라이브 스트림 — 우주정거장 궤도 영상",
      description: "NASA 국제우주정거장(ISS)의 실시간 외부 카메라 영상을 감상하세요.",
      alternates,
    };
  } else if (lang === 'ja') {
    return {
      title: "ISSライブストリーム — 宇宙ステーション軌道映像",
      description: "NASA国際宇宙ステーション（ISS）のリアルタイム外部カメラ映像をご覧ください。",
      alternates,
    };
  }
  
  return {
    title: "ISS Live Stream — Orbital Camera Feed",
    description: "Watch the real-time external camera feed from the NASA International Space Station (ISS).",
    alternates,
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BroadcastEvent',
    name: 'NASA ISS Live Stream',
    url: `https://space.raondr.com/${lang}/stream`,
    description: lang === 'ko' ? 'NASA 국제우주정거장 실시간 외부 카메라 영상' : 'NASA International Space Station live external camera stream.',
    isLiveBroadcast: true,
    videoFormat: 'HD',
    broadcastOfEvent: {
      '@type': 'Event',
      name: 'ISS Orbit',
      location: {
        '@type': 'Place',
        name: 'Low Earth Orbit'
      }
    },
    publisher: {
      '@type': 'Organization',
      name: 'NASA'
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientHome lang={lang} />
    </>
  );
}
