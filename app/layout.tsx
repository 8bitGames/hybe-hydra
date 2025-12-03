import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hydra.ai";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  // 기본 메타데이터
  title: {
    default: "Hydra - AI 영상 자동화 플랫폼 | 브랜드 숏폼 대량 제작",
    template: "%s | Hydra",
  },
  description:
    "Hydra는 기업과 브랜드를 위한 AI 영상 오케스트레이션 플랫폼입니다. 트렌드 인텔리전스 기반으로 브랜드 IP를 활용한 숏폼 콘텐츠를 몇 분 만에 수천 개 생성하고, TikTok·Instagram·YouTube Shorts에 자동 배포하세요. 콘텐츠 마케팅의 새로운 패러다임을 경험하세요.",

  // 키워드
  keywords: [
    // 핵심 키워드
    "AI 영상 제작",
    "AI 비디오 생성",
    "숏폼 자동화",
    "브랜드 콘텐츠 자동화",
    "AI 마케팅 플랫폼",
    // 기능 키워드
    "트렌드 분석",
    "자동 영상 편집",
    "대량 콘텐츠 생성",
    "멀티 플랫폼 배포",
    "소셜미디어 자동화",
    // 플랫폼 키워드
    "틱톡 마케팅",
    "인스타그램 릴스",
    "유튜브 쇼츠",
    "SNS 마케팅 자동화",
    // 타겟 키워드
    "엔터프라이즈 마케팅",
    "브랜드 마케팅 솔루션",
    "콘텐츠 마케팅 플랫폼",
    "디지털 마케팅 자동화",
    // 영문 키워드 (글로벌 검색용)
    "AI video generation",
    "short-form content automation",
    "brand video platform",
    "TikTok marketing automation",
  ],

  // 작성자 및 퍼블리셔
  authors: [{ name: "Hydra", url: siteUrl }],
  creator: "Hydra",
  publisher: "Hydra",

  // 로봇 설정
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // 정규 URL
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
      "en-US": "/?lang=en",
    },
  },

  // Open Graph (Facebook, LinkedIn, KakaoTalk 등)
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: "en_US",
    url: siteUrl,
    siteName: "Hydra",
    title: "Hydra - AI 영상 자동화 플랫폼 | 브랜드 숏폼 대량 제작",
    description:
      "AI 기반 트렌드 분석으로 브랜드 숏폼 콘텐츠를 몇 분 만에 수천 개 생성하세요. TikTok, Instagram, YouTube Shorts 자동 배포까지 한 번에.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hydra - AI 영상 자동화 플랫폼",
        type: "image/png",
      },
      {
        url: "/og-image-square.png",
        width: 600,
        height: 600,
        alt: "Hydra 로고",
        type: "image/png",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Hydra - AI 영상 자동화 플랫폼",
    description:
      "트렌드 기반 AI로 브랜드 숏폼 콘텐츠를 대량 생성하고 자동 배포하세요.",
    images: ["/og-image.png"],
    creator: "@hydra_ai",
    site: "@hydra_ai",
  },

  // 아이콘
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },

  // 매니페스트
  manifest: "/manifest.json",

  // 카테고리
  category: "technology",

  // 분류
  classification: "Business Software, Marketing Technology, AI Platform",

  // 추가 메타 태그
  other: {
    // 네이버 검색 최적화
    "naver-site-verification": "", // 네이버 웹마스터 도구 인증 코드
    // 구글 검색 최적화
    "google-site-verification": "", // 구글 서치 콘솔 인증 코드
    // 모바일 앱 배너 (향후 앱 출시 시)
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Hydra",
    // 포맷 감지 비활성화
    "format-detection": "telephone=no",
    // 추가 SEO
    "revisit-after": "7 days",
    "rating": "general",
    "distribution": "global",
    "coverage": "Worldwide",
    "target": "all",
    // 비즈니스 정보
    "business:contact_data:locality": "Seoul",
    "business:contact_data:country_name": "South Korea",
  },
};

// JSON-LD 구조화 데이터
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    // Organization
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Hydra",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/icon-512.png`,
        width: 512,
        height: 512,
      },
      description:
        "기업과 브랜드를 위한 AI 영상 오케스트레이션 플랫폼",
      foundingDate: "2024",
      areaServed: {
        "@type": "Country",
        name: "South Korea",
      },
      sameAs: [
        // 소셜 미디어 링크 추가 시
      ],
    },
    // WebSite
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Hydra",
      description: "AI 영상 자동화 플랫폼",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      inLanguage: ["ko-KR", "en-US"],
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    // SoftwareApplication (Product)
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "Hydra",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "트렌드 인텔리전스 기반 AI 영상 자동화 플랫폼. 브랜드 숏폼 콘텐츠를 대량 생성하고 멀티 플랫폼에 자동 배포합니다.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
        description: "무료 체험 가능",
      },
      featureList: [
        "AI 기반 트렌드 분석",
        "브랜드 IP 통합 영상 생성",
        "대량 숏폼 콘텐츠 제작",
        "TikTok/Instagram/YouTube Shorts 자동 배포",
        "실시간 성과 분석",
      ],
      screenshot: `${siteUrl}/og-image.png`,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "150",
        bestRating: "5",
        worstRating: "1",
      },
    },
    // WebPage (Landing Page)
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/#webpage`,
      url: siteUrl,
      name: "Hydra - AI 영상 자동화 플랫폼",
      isPartOf: {
        "@id": `${siteUrl}/#website`,
      },
      about: {
        "@id": `${siteUrl}/#software`,
      },
      description:
        "기업과 브랜드를 위한 AI 영상 오케스트레이션 플랫폼. 트렌드 기반으로 숏폼 콘텐츠를 대량 생성하고 자동 배포하세요.",
      inLanguage: "ko-KR",
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${siteUrl}/og-image.png`,
      },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "홈",
            item: siteUrl,
          },
        ],
      },
    },
    // FAQPage (검색 결과에 FAQ 표시 - AEO 최적화)
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Hydra는 어떤 플랫폼인가요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hydra는 기업과 브랜드를 위한 AI 영상 오케스트레이션 플랫폼입니다. 트렌드 인텔리전스를 기반으로 브랜드 IP를 활용한 숏폼 콘텐츠를 몇 분 만에 수천 개 생성하고, TikTok, Instagram, YouTube Shorts에 자동으로 배포할 수 있습니다.",
          },
        },
        {
          "@type": "Question",
          name: "AI 영상 생성은 어떻게 작동하나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hydra는 실시간 트렌드 분석을 통해 최적의 콘텐츠 전략을 제안하고, 브랜드 에셋(이미지, 영상, 음악)을 AI가 자동으로 조합하여 트렌드에 맞는 숏폼 영상을 생성합니다. 생성된 영상은 자동으로 최적화되어 각 플랫폼에 배포됩니다.",
          },
        },
        {
          "@type": "Question",
          name: "어떤 플랫폼에 영상을 배포할 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "TikTok, Instagram Reels, YouTube Shorts 등 주요 숏폼 플랫폼에 자동으로 영상을 배포할 수 있습니다. 각 플랫폼의 특성에 맞게 영상이 자동으로 최적화됩니다.",
          },
        },
        {
          "@type": "Question",
          name: "무료로 사용할 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "네, Hydra는 무료 체험을 제공합니다. 회원가입 후 바로 AI 영상 생성 기능을 체험해보실 수 있습니다.",
          },
        },
        {
          "@type": "Question",
          name: "영상 생성에 얼마나 걸리나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "브랜드 에셋(이미지, 영상, 음악)만 업로드하면 AI가 몇 분 내에 수천 개의 영상 변형을 자동으로 생성합니다. 대량 생성도 병렬 처리로 빠르게 완료됩니다.",
          },
        },
        {
          "@type": "Question",
          name: "트렌드 분석은 어떻게 하나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hydra는 TikTok, Instagram, YouTube의 실시간 트렌드를 AI로 분석합니다. 바이럴 가능성이 높은 포맷, 음악, 해시태그를 자동으로 추천하여 콘텐츠 성과를 극대화합니다.",
          },
        },
        {
          "@type": "Question",
          name: "기존 브랜드 에셋을 활용할 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "네, 기존 이미지, 영상, 음악 파일을 업로드하여 브랜드 일관성을 유지하면서 다양한 콘텐츠를 생성할 수 있습니다. 브랜드 가이드라인에 맞춰 AI가 콘텐츠를 제작합니다.",
          },
        },
        {
          "@type": "Question",
          name: "한국어와 영어 모두 지원하나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "네, Hydra는 한국어와 영어를 모두 지원합니다. 글로벌 브랜드의 경우 각 시장에 맞는 현지화된 콘텐츠를 생성할 수 있습니다.",
          },
        },
      ],
    },
    // HowTo Schema (GEO - 생성형 AI가 단계별 가이드로 활용)
    {
      "@type": "HowTo",
      "@id": `${siteUrl}/#howto`,
      name: "Hydra로 AI 숏폼 영상 만드는 방법",
      description:
        "Hydra 플랫폼을 사용하여 브랜드 숏폼 영상을 대량으로 생성하고 배포하는 단계별 가이드입니다.",
      image: `${siteUrl}/og-image.png`,
      totalTime: "PT10M",
      estimatedCost: {
        "@type": "MonetaryAmount",
        currency: "KRW",
        value: "0",
      },
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "회원가입",
          text: "Hydra 웹사이트에서 무료 계정을 생성합니다. 이메일 인증 후 바로 시작할 수 있습니다.",
          url: `${siteUrl}/register`,
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "브랜드 에셋 업로드",
          text: "브랜드 이미지, 영상 클립, 음악 파일을 업로드합니다. 다양한 포맷을 지원합니다.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "트렌드 분석 확인",
          text: "AI가 분석한 실시간 트렌드를 확인하고, 추천 포맷과 해시태그를 선택합니다.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "AI 영상 생성",
          text: "생성 버튼을 클릭하면 AI가 트렌드에 맞는 숏폼 영상을 자동으로 대량 생성합니다.",
        },
        {
          "@type": "HowToStep",
          position: 5,
          name: "멀티 플랫폼 배포",
          text: "생성된 영상을 TikTok, Instagram Reels, YouTube Shorts에 자동으로 배포합니다.",
        },
      ],
    },
    // Speakable Schema (음성 검색 최적화 - AEO)
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/#speakable-page`,
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: [".hero-headline", ".hero-description", ".feature-title"],
        xpath: [
          "/html/body//h1",
          "/html/body//section[@id='features']//h2",
          "/html/body//section[@id='how-it-works']//h2",
        ],
      },
    },
    // Service Schema (서비스 상세 - GEO)
    {
      "@type": "Service",
      "@id": `${siteUrl}/#service`,
      name: "Hydra AI 영상 자동화 서비스",
      serviceType: "AI Video Generation Platform",
      provider: {
        "@id": `${siteUrl}/#organization`,
      },
      description:
        "트렌드 기반 AI로 브랜드 숏폼 콘텐츠를 대량 생성하고 TikTok, Instagram, YouTube에 자동 배포하는 엔터프라이즈 서비스",
      areaServed: {
        "@type": "Country",
        name: "South Korea",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Hydra 요금제",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "무료 체험",
              description: "AI 영상 생성 기능 무료 체험",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "엔터프라이즈",
              description: "대규모 브랜드를 위한 맞춤 솔루션",
            },
          },
        ],
      },
    },
    // ItemList (주요 기능 목록 - 리치 스니펫)
    {
      "@type": "ItemList",
      "@id": `${siteUrl}/#features-list`,
      name: "Hydra 주요 기능",
      description: "AI 영상 자동화 플랫폼의 핵심 기능 목록",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "트렌드 인텔리전스",
          description:
            "TikTok, Instagram, YouTube 실시간 트렌드 AI 분석 및 바이럴 콘텐츠 추천",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "AI 영상 대량 생성",
          description:
            "브랜드 에셋 기반 숏폼 콘텐츠 자동 생성, 수천 개 변형 동시 제작",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "멀티 플랫폼 자동 배포",
          description:
            "TikTok, Instagram Reels, YouTube Shorts 동시 배포 및 플랫폼별 최적화",
        },
        {
          "@type": "ListItem",
          position: 4,
          name: "실시간 성과 분석",
          description:
            "조회수, 참여율, ROI 실시간 추적 및 A/B 테스트 기반 최적화",
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* JSON-LD 구조화 데이터 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${notoSansKR.variable} ${GeistSans.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
