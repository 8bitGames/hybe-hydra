export type Language = 'ko' | 'en';

export const translations = {
  ko: {
    nav: {
      features: '주요 기능',
      howItWorks: '작동 방식',
      useCases: '도입 사례',
      contact: '문의하기',
      requestDemo: '데모 신청',
    },
    hero: {
      headline1: '수천 개의 브랜드 영상 제작,',
      headline2: 'AI로 단 몇 분 만에',
      subheadline: '트렌드 분석부터 대량 생성, 멀티 플랫폼 배포까지. 브랜드 IP를 완벽하게 학습한 AI가 맞춤형 영상 콘텐츠를 자동으로 완성합니다.',
      cta: {
        primary: '시작하기',
        secondary: '로그인',
      },
    },
    problem: {
      headline1: '매일 수백 개의 숏폼 콘텐츠가 필요하신가요?',
      headline2: '하지만 제작 리소스는 늘 부족합니다.',
      painPoints: [
        {
          title: '따라잡기 힘든 트렌드',
          description: '지금 무엇이 뜨고 있는지 파악하는 데만 수 시간이 소요됩니다.',
        },
        {
          title: '비효율적인 반복 작업',
          description: '비슷한 포맷의 영상을 수십 개씩 단순 반복 생산해야 합니다.',
        },
        {
          title: '브랜드 톤앤매너 유지',
          description: '대량 제작 시 브랜드 가이드라인과 퀄리티를 유지하기 어렵습니다.',
        },
        {
          title: '복잡한 플랫폼 최적화',
          description: 'TikTok, Reels, Shorts 등 채널마다 다른 규격과 문법이 필요합니다.',
        },
      ],
    },
    features: {
      trendIntelligence: {
        label: '소셜 리서치',
        title: '트렌드 인텔리전스',
        subtitle: '누구보다 먼저 트렌드를 선점하세요',
        description: 'TikTok과 Instagram의 실시간 트렌드를 수집하고 분석합니다. 해시태그 전략, 영상 스타일, 컬러 팔레트까지 AI가 분석하여 가장 반응이 좋은 콘텐츠 방향성을 제시합니다.',
        bullets: [
          '실시간 해시태그 트렌드 분석',
          'AI 기반 바이럴 영상 스타일 분석',
          '트렌드 키워드 자동 추천',
        ],
      },
      brandIP: {
        label: 'IP 보호',
        title: '브랜드 IP 통합',
        subtitle: '브랜드 자산이 영상의 핵심이 됩니다',
        description: '로고, 제품 이미지, 음원, 브랜드 가이드라인을 업로드하세요. AI가 이를 학습하여 브랜드 정체성을 해치지 않는 영상을 생성합니다. 굿즈, 앨범, 의류 등 귀사의 제품을 영상 속에 자연스럽게 녹여냅니다.',
        bullets: [
          '브랜드 에셋 라이브러리 구축',
          '제품 이미지 자동 합성 및 통합',
          '브랜드 가이드라인 준수 여부 검증',
        ],
      },
      massGeneration: {
        label: '스케일',
        title: '초대형 대량 생성',
        subtitle: '수백, 수천 개의 영상을 단 한 번에',
        description: '단 하나의 컨셉으로 수백 가지의 베리에이션을 자동 생성합니다. 스타일, 음악, 제품, 텍스트를 다양하게 조합하여 A/B 테스트 가능한 무한한 변형을 만들어냅니다.',
        bullets: [
          '배치(Batch) 작업을 통한 대량 제작',
          '스타일 프리셋 일괄 적용',
          'AI 자동 품질 스코어링',
        ],
      },
      oneClickPublish: {
        label: '자동화',
        title: '원클릭 통합 배포',
        subtitle: '모든 플랫폼에 동시에 도달하세요',
        description: 'TikTok, Instagram, YouTube 계정을 직접 연동하여 예약 발행, 자동 배포, 성과 추적까지 한 곳에서 관리합니다. 각 플랫폼에 최적화된 포맷으로 자동 변환되어 업로드됩니다.',
        bullets: [
          '멀티 플랫폼 동시 배포 시스템',
          '스케줄링 및 자동 업로드',
          '실시간 성과 데이터 동기화',
        ],
      },
      hyperpersonalization: {
        label: '글로벌 타겟팅',
        title: '하이퍼 로컬라이제이션',
        subtitle: '타겟 국가의 트렌드를 실시간으로 반영합니다',
        description: '미국, 일본, 동남아 등 타겟 시장의 로컬 트렌드를 실시간으로 수집합니다. 해당 지역에서 실제로 바이럴되는 코드를 분석하여, 현지 문화와 취향을 저격하는 맞춤형 영상을 생성합니다.',
        bullets: [
          '국가/지역별 트렌드 데이터 수집',
          '로컬 해시태그 & 키워드 자동 적용',
          '문화권별 선호 스타일 최적화',
        ],
      },
      aeoGeo: {
        label: '바이럴 최적화',
        title: 'AEO/GEO 최적화 카피',
        subtitle: '알고리즘이 선택하는 콘텐츠를 만듭니다',
        description: '각 플랫폼의 최신 알고리즘 패턴을 분석하여 검색 최적화(AEO)와 지역 최적화(GEO)가 적용된 텍스트를 자동 생성합니다. 해시태그, 캡션, 키워드 조합으로 노출 확률을 극대화합니다.',
        bullets: [
          'AI 기반 바이럴 카피라이팅',
          '플랫폼별 알고리즘 맞춤 최적화',
          '검색 및 추천 노출 극대화 전략',
        ],
      },
    },
    howItWorks: {
      label: '프로세스',
      title: '4단계로 완성되는 콘텐츠 자동화',
      steps: [
        {
          number: '01',
          title: '분석 (Research)',
          subtitle: '트렌드 분석 및 전략 수립',
          description: 'AI가 현재 트렌드를 분석하고 최적의 콘텐츠 방향을 제안합니다.',
        },
        {
          number: '02',
          title: '생성 (Create)',
          subtitle: 'AI 기반 대량 영상 제작',
          description: '프롬프트 입력 한 번으로 브랜드 맞춤형 영상을 대량 생성합니다.',
        },
        {
          number: '03',
          title: '선별 (Review)',
          subtitle: '품질 확인 및 큐레이션',
          description: 'AI 품질 스코어를 통해 최고의 성과가 예상되는 콘텐츠를 선별합니다.',
        },
        {
          number: '04',
          title: '배포 (Publish)',
          subtitle: '멀티 플랫폼 자동 배포',
          description: '모든 채널에 최적화된 포맷으로 스케줄링하여 자동 발행합니다.',
        },
      ],
    },
    useCases: {
      label: '활용 사례',
      title: '모든 규모의 브랜드에 최적화된 솔루션',
      cases: [
        {
          title: '엔터테인먼트',
          tagline: '아티스트 프로모션, 팬 콘텐츠, 앨범 마케팅',
          description: '아티스트별로 수십 개의 계정을 운영하면서도, 일관된 세계관과 브랜드 이미지를 유지할 수 있습니다.',
        },
        {
          title: '이커머스',
          tagline: '제품 시연, 리뷰 영상, 프로모션 광고',
          description: '수천 개의 SKU(제품) 각각에 최적화된 마케팅 영상을 자동으로 생성하고 배포합니다.',
        },
        {
          title: '에이전시',
          tagline: '다중 클라이언트 관리, 캠페인 운영 효율화',
          description: '여러 클라이언트의 엄격한 브랜드 가이드라인을 준수하면서도, 압도적인 물량의 콘텐츠를 제작합니다.',
        },
      ],
    },
    capabilities: {
      label: '핵심 기능',
      title: '엔터프라이즈를 위한 완벽한 기능 명세',
      items: [
        { title: 'AI 프롬프트 최적화', description: '자연어를 영상 생성에 최적화된 프롬프트로 변환' },
        { title: '글로벌 트렌드 수집', description: '타겟 시장의 로컬 트렌드 데이터 실시간 분석' },
        { title: '스타일 프리셋', description: '시네마틱, 로파이, 네온 등 다양한 비주얼 스타일' },
        { title: '멀티 플랫폼 배포', description: 'TikTok, Instagram, YouTube 완벽 지원' },
        { title: 'AEO 카피 생성', description: '알고리즘에 최적화된 해시태그 & 캡션 자동 생성' },
        { title: 'GEO 타겟팅', description: '국가/지역별 맞춤형 콘텐츠 최적화' },
        { title: '실시간 분석 대시보드', description: '조회수, 참여율, 성과 지표 자동 추적' },
        { title: '팀 협업 워크플로우', description: '역할 기반 권한 관리(RBAC) 및 승인 프로세스' },
        { title: '브랜드 컴플라이언스', description: '가이드라인 자동 검증 및 위반 방지' },
        { title: '바이럴 최적화', description: '플랫폼별 노출 극대화 전략 적용' },
        { title: '문화권별 최적화', description: '로컬 문화와 정서에 맞는 콘텐츠 스타일링' },
        { title: 'API 연동', description: '기존 레거시 시스템과의 원활한 통합 지원' },
      ],
    },
    cta: {
      title: '지금 바로 시작해보세요',
      subtitle: '콘텐츠 제작 방식의 혁신, 준비되셨나요?',
      primary: '시작하기',
      secondary: '로그인',
    },
    footer: {
      features: '기능',
      howItWorks: '작동 방식',
      useCases: '활용 사례',
      contact: '문의',
      terms: '이용약관',
      privacy: '개인정보처리방침',
      copyright: 'All rights reserved.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      howItWorks: 'How It Works',
      useCases: 'Use Cases',
      contact: 'Contact',
      requestDemo: 'Request Demo',
    },
    hero: {
      headline1: 'Thousands of Brand Videos',
      headline2: 'Created by AI in Minutes',
      subheadline: 'From trend analysis to mass generation and multi-platform publishing. Automatically create custom video content using your brand\'s IP.',
      cta: {
        primary: 'Get Started',
        secondary: 'Sign In',
      },
    },
    problem: {
      headline1: 'You need hundreds of content pieces every day.',
      headline2: 'But there\'s never enough time to create them.',
      painPoints: [
        {
          title: 'Trend Discovery is Hard',
          description: 'It takes hours just to figure out what\'s trending right now',
        },
        {
          title: 'Repetitive Production',
          description: 'The inefficiency of creating dozens of similar videos',
        },
        {
          title: 'Brand Consistency',
          description: 'Hard to maintain brand guidelines when producing at scale',
        },
        {
          title: 'Platform Optimization',
          description: 'TikTok, Instagram, YouTube each need different formats',
        },
      ],
    },
    features: {
      trendIntelligence: {
        label: 'Social Research',
        title: 'Trend Intelligence',
        subtitle: 'Knowing what\'s hot before others is your advantage',
        description: 'Collect and analyze trends from TikTok and Instagram in real-time. AI analyzes hashtag strategies, video styles, and color palettes to suggest the most effective content direction.',
        bullets: [
          'Real-time hashtag trend analysis',
          'AI-powered video style analysis',
          'Automatic trend keyword recommendations',
        ],
      },
      brandIP: {
        label: 'IP Protection',
        title: 'Brand IP Integration',
        subtitle: 'Your IP becomes the center of every video',
        description: 'Upload your logos, product images, music, and brand guidelines. AI learns from them to generate videos that maintain your brand identity. Seamlessly integrate products like merchandise, albums, and apparel into videos.',
        bullets: [
          'Brand asset library management',
          'Automatic product image integration',
          'Brand guideline compliance verification',
        ],
      },
      massGeneration: {
        label: 'Scale',
        title: 'Mass Generation',
        subtitle: 'Hundreds, thousands of videos at once',
        description: 'Automatically generate hundreds of variations from a single concept. Combine styles, music, products, and text to create infinite variations for testing.',
        bullets: [
          'Batch generation for mass production',
          'Bulk style preset application',
          'Automatic quality scoring',
        ],
      },
      oneClickPublish: {
        label: 'Automation',
        title: 'One-Click Publishing',
        subtitle: 'To all platforms simultaneously',
        description: 'Connect directly to TikTok, Instagram, and YouTube. Manage scheduled publishing, automatic deployment, and performance tracking all in one place. Auto-convert to optimal formats for each platform.',
        bullets: [
          'Multi-platform simultaneous publishing',
          'Scheduling and automatic posting',
          'Real-time performance sync',
        ],
      },
      hyperpersonalization: {
        label: 'Global Targeting',
        title: 'Hyperpersonalization & Localization',
        subtitle: 'Local trends become your content',
        description: 'Collect real-time local trends from target markets like US, Japan, and Southeast Asia. Analyze what\'s actually going viral in each region and automatically generate videos tailored to local culture and preferences.',
        bullets: [
          'Country/region-specific trend collection',
          'Auto-apply local hashtags & keywords',
          'Culture-optimized content styles',
        ],
      },
      aeoGeo: {
        label: 'Viral Optimization',
        title: 'AEO/GEO Optimized Copy',
        subtitle: 'Create content the algorithm chooses',
        description: 'AI analyzes each platform\'s algorithm patterns to automatically generate AEO (Algorithm Engine Optimization) and GEO (Geographic Engine Optimization) copy. Hashtags, captions, and keywords perfectly optimized for viral potential.',
        bullets: [
          'AI-powered viral copy generation',
          'Platform algorithm optimization',
          'Maximize search & recommendation exposure',
        ],
      },
    },
    howItWorks: {
      label: 'Process',
      title: 'Content Automation in 4 Steps',
      steps: [
        {
          number: '01',
          title: 'Research',
          subtitle: 'Trend analysis & strategy',
          description: 'AI analyzes current trends and suggests optimal content direction',
        },
        {
          number: '02',
          title: 'Create',
          subtitle: 'AI-powered mass production',
          description: 'Generate hundreds of brand-customized videos from a single prompt',
        },
        {
          number: '03',
          title: 'Review',
          subtitle: 'Quality check & curation',
          description: 'Quickly select the best content with AI quality scoring',
        },
        {
          number: '04',
          title: 'Publish',
          subtitle: 'Multi-platform auto-deployment',
          description: 'Schedule optimized content across all channels',
        },
      ],
    },
    useCases: {
      label: 'Use Cases',
      title: 'Any Brand, Any Scale',
      cases: [
        {
          title: 'Entertainment',
          tagline: 'Artist promotion, fan content, album marketing',
          description: 'Manage dozens of accounts per artist while maintaining consistent brand image',
        },
        {
          title: 'E-commerce',
          tagline: 'Product videos, review content, promotional ads',
          description: 'Automatically generate and distribute custom videos for thousands of products',
        },
        {
          title: 'Agency',
          tagline: 'Multi-client management, campaign operations',
          description: 'Create large volumes of content while respecting each client\'s brand guidelines',
        },
      ],
    },
    capabilities: {
      label: 'Core Features',
      title: 'The Complete Solution for Enterprise',
      items: [
        { title: 'AI Prompt Optimization', description: 'Convert natural language to optimal video prompts' },
        { title: 'Regional Trend Collection', description: 'Real-time analysis of local market trends' },
        { title: 'Style Presets', description: 'Cinematic, lo-fi, neon, and more styles' },
        { title: 'Multi-Platform Publishing', description: 'TikTok, Instagram, YouTube support' },
        { title: 'AEO Copy Generation', description: 'Algorithm-optimized hashtags & captions' },
        { title: 'GEO Targeting', description: 'Country/region-specific content optimization' },
        { title: 'Real-time Analytics', description: 'Auto-track views, engagement, performance' },
        { title: 'Team Collaboration', description: 'Role-based permissions and workflows' },
        { title: 'Brand Compliance', description: 'Automatic guideline verification' },
        { title: 'Viral Optimization', description: 'Maximize exposure per platform' },
        { title: 'Cultural Optimization', description: 'Local culture-matched content styles' },
        { title: 'API Integration', description: 'Seamless integration with existing systems' },
      ],
    },
    cta: {
      title: 'Start Creating Today',
      subtitle: 'Ready to revolutionize your content production?',
      primary: 'Get Started',
      secondary: 'Sign In',
    },
    footer: {
      features: 'Features',
      howItWorks: 'How It Works',
      useCases: 'Use Cases',
      contact: 'Contact',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      copyright: 'All rights reserved.',
    },
  },
} as const;

export function getTranslation(lang: Language) {
  return translations[lang];
}
