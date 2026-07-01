import { Metadata } from 'next';
import Script from 'next/script';
import ClientHome from './ClientHome';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = 'https://space.raondr.com';
  const alternates = {
    canonical: `${baseUrl}/${lang}`,
    languages: {
      'en': `${baseUrl}/en`,
      'ko': `${baseUrl}/ko`,
      'ja': `${baseUrl}/ja`,
      'zh': `${baseUrl}/zh`,
      'es': `${baseUrl}/es`,
      'fr': `${baseUrl}/fr`,
      'de': `${baseUrl}/de`,
      'pt': `${baseUrl}/pt`,
      'x-default': `${baseUrl}/en`,
    },
  };
  
  if (lang === 'ko') {
    return {
      title: "실시간 국제우주정거장 — 라이브 ISS 트래커 & 우주 앰비언트",
      description: "NASA의 실시간 ISS 외부 카메라 스트리밍과 우주 원격 측정 데이터를 경험하세요. 잔잔한 로파이 음악과 함께 우주의 평온함을 느껴보세요.",
      alternates,
      openGraph: {
        title: "실시간 국제우주정거장 — 라이브 ISS 트래커 & 우주 앰비언트",
        description: "NASA의 실시간 ISS 외부 카메라 스트리밍과 우주 원격 측정 데이터를 경험하세요.",
      },
      twitter: {
        title: "실시간 국제우주정거장 — 라이브 ISS 트래커 & 우주 앰비언트",
        description: "NASA의 실시간 ISS 외부 카메라 스트리밍과 우주 원격 측정 데이터를 경험하세요.",
      }
    };
  } else if (lang === 'ja') {
    return {
      title: "リアルタイム国際宇宙ステーション — ライブISSトラッカー＆宇宙アンビエント",
      description: "NASAのリアルタイムISS外部カメラストリーミングと宇宙テレメトリデータを体験してください。",
      alternates,
    };
  } else if (lang === 'zh') {
    return {
      title: "实时国际空间站 — 实时ISS追踪器与太空氛围",
      description: "体验NASA的实时ISS外部摄像机流和太空遥测数据。",
      alternates,
    };
  } else if (lang === 'es') {
    return {
      title: "Estación Espacial Internacional en Vivo — Rastreador ISS y Ambiente Espacial",
      description: "Experimenta las transmisiones en vivo de la cámara externa de la ISS de la NASA y la telemetría espacial.",
      alternates,
    };
  }
  
  return {
    title: "Orbital Lofi Station — Live ISS Tracker & Space Ambient",
    description: "Experience real-time NASA ISS external camera streams and space telemetry. Relax with ambient lofi beats.",
    alternates,
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['WebSite', 'WebApplication'],
    name: 'Orbital Lofi Station',
    url: `https://space.raondr.com/${lang}`,
    description: lang === 'ko' ? 'NASA의 실시간 ISS 외부 카메라 스트리밍과 우주 원격 측정 데이터를 경험하세요.' : 'Experience real-time NASA ISS external camera streams and space telemetry. Relax with ambient lofi beats.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Orbital Lofi',
      url: 'https://space.raondr.com'
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Script
        id="adsbygoogle-init"
        strategy="afterInteractive"
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8746170027746957"
        crossOrigin="anonymous"
      />
      <ClientHome lang={lang} />
    </>
  );
}
