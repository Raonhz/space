import React from 'react';
import Link from 'next/link';

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  const content = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last Updated: July 2026",
      p1: "This Privacy Policy explains how Orbital Lofi Station (\"we\", \"us\", or \"our\") collects, uses, and discloses your information when you use our website (space.raondr.com).",
      s1: "1. Information We Collect",
      p2: "We use Google Analytics (GA4) to collect standard internet log information and details of visitor behavior patterns. This information may include your IP address, browser type, operating system, referring URLs, and pages visited.",
      s2: "2. Cookies",
      p3: "Our website uses cookies to improve user experience and analyze website traffic. By using our website, you consent to the use of cookies in accordance with this Privacy Policy. You can disable cookies through your browser settings.",
      s3: "3. Third-Party Services",
      p4: "We utilize NASA's public API and video streams. We do not transmit your personal data to NASA. However, Google Analytics may process data outside your country of residence.",
      s4: "4. Contact Us",
      p5: "If you have any questions about this Privacy Policy, please contact the site administrator.",
      back: "Return to Console"
    },
    ko: {
      title: "개인정보처리방침",
      lastUpdated: "최종 수정일: 2026년 7월",
      p1: "본 개인정보처리방침은 귀하가 Orbital Lofi Station (space.raondr.com)을 이용할 때 당사가 귀하의 정보를 수집, 사용 및 공개하는 방법을 설명합니다.",
      s1: "1. 수집하는 정보",
      p2: "당사는 Google Analytics(GA4)를 사용하여 인터넷 로그 정보 및 방문자 행동 패턴을 수집합니다. 이 정보에는 귀하의 IP 주소, 브라우저 유형, 운영 체제, 참조 URL 및 방문한 페이지가 포함될 수 있습니다.",
      s2: "2. 쿠키(Cookies)",
      p3: "당사 웹사이트는 사용자 경험을 향상시키고 트래픽을 분석하기 위해 쿠키를 사용합니다. 웹사이트를 이용함으로써 귀하는 쿠키 사용에 동의하게 됩니다. 브라우저 설정을 통해 쿠키를 비활성화할 수 있습니다.",
      s3: "3. 제3자 서비스",
      p4: "당사는 NASA의 공개 API 및 비디오 스트림을 활용합니다. 당사는 귀하의 개인 데이터를 NASA에 전송하지 않습니다. 단, Google Analytics는 귀하의 거주 국가 외부에 데이터를 전송하고 처리할 수 있습니다.",
      s4: "4. 문의",
      p5: "본 개인정보처리방침에 대한 질문이 있으시면 사이트 관리자에게 문의해 주십시오.",
      back: "콘솔로 돌아가기"
    },
    ja: {
      title: "プライバシーポリシー",
      lastUpdated: "最終更新日: 2026年7月",
      p1: "このプライバシーポリシーは、Orbital Lofi Station（space.raondr.com）を使用する際の情報収集、使用、および開示について説明します。",
      s1: "1. 収集する情報",
      p2: "Google Analytics（GA4）を使用して、インターネットログ情報と訪問者の行動パターンを収集します。これには、IPアドレス、ブラウザの種類、オペレーティングシステム、参照URLなどが含まれます。",
      s2: "2. クッキー（Cookies）",
      p3: "当ウェブサイトでは、ユーザー体験の向上とトラフィック分析のためにクッキーを使用しています。設定により無効化することも可能です。",
      s3: "3. サードパーティサービス",
      p4: "NASAの公開APIとビデオストリームを利用しています。個人データはNASAには送信されませんが、Google Analyticsによってデータが処理される場合があります。",
      s4: "4. お問い合わせ",
      p5: "ご質問がある場合は、サイト管理者にお問い合わせください。",
      back: "コンソールに戻る"
    },
    zh: {
      title: "隐私政策",
      lastUpdated: "最后更新: 2026年7月",
      p1: "本隐私政策解释了当您使用 Orbital Lofi Station (space.raondr.com) 时，我们如何收集、使用和披露您的信息。",
      s1: "1. 我们收集的信息",
      p2: "我们使用 Google Analytics (GA4) 来收集互联网日志信息和访问者行为模式，包括IP地址、浏览器类型等。",
      s2: "2. Cookies",
      p3: "我们的网站使用Cookies来改善用户体验和分析网站流量。您可以通过浏览器设置禁用Cookies。",
      s3: "3. 第三方服务",
      p4: "我们使用NASA的公开API和视频流。我们不会将您的个人数据发送给NASA，但 Google Analytics 可能会处理您的数据。",
      s4: "4. 联系我们",
      p5: "如果您有任何问题，请联系网站管理员。",
      back: "返回控制台"
    },
    es: {
      title: "Política de Privacidad",
      lastUpdated: "Última actualización: Julio 2026",
      p1: "Esta Política de Privacidad explica cómo Orbital Lofi Station recopila, utiliza y divulga su información.",
      s1: "1. Información que recopilamos",
      p2: "Utilizamos Google Analytics (GA4) para recopilar información de registro estándar y patrones de comportamiento.",
      s2: "2. Cookies",
      p3: "Nuestro sitio web utiliza cookies para mejorar la experiencia del usuario y analizar el tráfico.",
      s3: "3. Servicios de terceros",
      p4: "Utilizamos la API pública y los flujos de video de la NASA. No transmitimos sus datos personales a la NASA.",
      s4: "4. Contáctenos",
      p5: "Si tiene alguna pregunta, comuníquese con el administrador del sitio.",
      back: "Volver a la consola"
    },
    fr: {
      title: "Politique de confidentialité",
      lastUpdated: "Dernière mise à jour: Juillet 2026",
      p1: "Cette politique de confidentialité explique comment Orbital Lofi Station collecte, utilise et divulgue vos informations.",
      s1: "1. Informations que nous collectons",
      p2: "Nous utilisons Google Analytics (GA4) pour collecter des informations standard et des modèles de comportement.",
      s2: "2. Cookies",
      p3: "Notre site utilise des cookies pour améliorer l'expérience utilisateur et analyser le trafic.",
      s3: "3. Services tiers",
      p4: "Nous utilisons l'API publique de la NASA. Nous ne transmettons pas vos données personnelles à la NASA.",
      s4: "4. Contactez-nous",
      p5: "Si vous avez des questions, veuillez contacter l'administrateur du site.",
      back: "Retour à la console"
    },
    de: {
      title: "Datenschutzrichtlinie",
      lastUpdated: "Zuletzt aktualisiert: Juli 2026",
      p1: "Diese Datenschutzrichtlinie erklärt, wie Orbital Lofi Station Ihre Informationen sammelt, verwendet und offenlegt.",
      s1: "1. Informationen, die wir sammeln",
      p2: "Wir verwenden Google Analytics (GA4), um Standardprotokollinformationen und Verhaltensmuster zu sammeln.",
      s2: "2. Cookies",
      p3: "Unsere Website verwendet Cookies, um die Benutzererfahrung zu verbessern und den Datenverkehr zu analysieren.",
      s3: "3. Dienste Dritter",
      p4: "Wir nutzen die öffentliche API der NASA. Wir übermitteln Ihre persönlichen Daten nicht an die NASA.",
      s4: "4. Kontaktiere uns",
      p5: "Wenn Sie Fragen haben, wenden Sie sich bitte an den Site-Administrator.",
      back: "Zurück zur Konsole"
    },
    pt: {
      title: "Política de Privacidade",
      lastUpdated: "Última atualização: Julho 2026",
      p1: "Esta Política de Privacidade explica como a Orbital Lofi Station coleta, usa e divulga suas informações.",
      s1: "1. Informações que coletamos",
      p2: "Usamos o Google Analytics (GA4) para coletar informações de registro e padrões de comportamento.",
      s2: "2. Cookies",
      p3: "Nosso site usa cookies para melhorar a experiência do usuário e analisar o tráfego.",
      s3: "3. Serviços de Terceiros",
      p4: "Utilizamos a API pública da NASA. Não transmitimos seus dados pessoais para a NASA.",
      s4: "4. Contate-nos",
      p5: "Se você tiver alguma dúvida, entre em contato com o administrador do site.",
      back: "Voltar para o console"
    }
  };

  const currentLang = Object.keys(content).includes(lang) ? lang as keyof typeof content : 'en';
  const data = content[currentLang];

  return (
    <main className="min-h-screen bg-black text-cyan-50 font-sans selection:bg-cyan-900 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 space-y-12">
        <header className="space-y-4">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-cyan-400 hover:text-white transition-colors text-sm font-mono uppercase tracking-widest group">
            <span className="opacity-50 group-hover:opacity-100 transition-opacity">←</span> {data.back}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{data.title}</h1>
          <p className="text-cyan-500/60 font-mono text-xs uppercase tracking-widest">{data.lastUpdated}</p>
        </header>

        <div className="space-y-10 text-cyan-50/80 leading-relaxed text-sm sm:text-base">
          <p className="text-white/90">{data.p1}</p>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-cyan-500/20 pb-2 inline-block">{data.s1}</h2>
            <p>{data.p2}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-cyan-500/20 pb-2 inline-block">{data.s2}</h2>
            <p>{data.p3}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-cyan-500/20 pb-2 inline-block">{data.s3}</h2>
            <p>{data.p4}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-cyan-500/20 pb-2 inline-block">{data.s4}</h2>
            <p>{data.p5}</p>
          </section>
        </div>
        
        <footer className="pt-12 border-t border-cyan-500/10 text-center text-cyan-500/40 font-mono text-xs tracking-widest uppercase">
          ORBITAL LOFI STATION © 2026
        </footer>
      </div>
    </main>
  );
}
