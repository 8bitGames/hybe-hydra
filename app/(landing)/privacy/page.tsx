"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>홈으로 돌아가기</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-muted-foreground mb-8">
          최종 수정일: {new Date().toLocaleDateString("ko-KR")}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          {/* 개요 */}
          <section>
            <p className="text-muted-foreground leading-relaxed">
              이온스튜디오 주식회사(이하 &quot;회사&quot;)는 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및
              관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다. 이에
              「개인정보 보호법」 제30조에 따라 정보주체에게 개인정보 처리에 관한 절차 및 기준을 안내하고,
              이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보
              처리방침을 수립·공개합니다.
            </p>
          </section>

          {/* 제1조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제1조 (개인정보의 처리목적)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의
              용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의
              동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                <strong>회원가입 및 관리</strong>
                <p className="ml-6 mt-1">
                  회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스
                  부정이용 방지, 각종 고지·통지, 고충처리 목적으로 개인정보를 처리합니다.
                </p>
              </li>
              <li>
                <strong>서비스 제공</strong>
                <p className="ml-6 mt-1">
                  AI 비디오 생성 서비스 제공, 트렌드 분석 결과 제공, 콘텐츠 저장 및 관리, 멀티플랫폼 배포
                  서비스, 맞춤형 서비스 제공, 본인인증, 결제 및 정산 목적으로 개인정보를 처리합니다.
                </p>
              </li>
              <li>
                <strong>마케팅 및 광고 활용</strong>
                <p className="ml-6 mt-1">
                  신규 서비스(제품) 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공,
                  인구통계학적 특성에 따른 서비스 제공 및 광고 게재, 서비스의 유효성 확인, 접속빈도 파악 또는
                  회원의 서비스 이용에 대한 통계 등을 목적으로 개인정보를 처리합니다.
                </p>
              </li>
              <li>
                <strong>AI 서비스 개선</strong>
                <p className="ml-6 mt-1">
                  AI 모델의 성능 개선, 서비스 품질 향상, 사용자 경험 분석 등의 목적으로 비식별화된 데이터를
                  활용합니다.
                </p>
              </li>
            </ol>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제2조 (처리하는 개인정보 항목)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 다음의 개인정보 항목을 처리하고 있습니다.
            </p>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <strong>1. 회원가입 시 수집 항목</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>필수항목: 이메일 주소, 비밀번호, 이름(또는 닉네임)</li>
                  <li>선택항목: 프로필 이미지, 회사명, 직책</li>
                </ul>
              </div>
              <div>
                <strong>2. 서비스 이용 과정에서 수집되는 항목</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>서비스 이용기록, 접속 로그, IP 주소, 쿠키</li>
                  <li>결제기록, 이용정지 기록</li>
                  <li>업로드한 콘텐츠 (비디오, 이미지, 오디오, 텍스트)</li>
                  <li>소셜 미디어 연동 정보 (TikTok, YouTube, Instagram 계정 연동 시)</li>
                </ul>
              </div>
              <div>
                <strong>3. AI 서비스 이용 시 수집되는 항목</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>비디오 생성 요청 내용 (프롬프트, 설정값)</li>
                  <li>트렌드 검색 기록</li>
                  <li>생성된 AI 콘텐츠 메타데이터</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제3조 (개인정보의 처리 및 보유기간)</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은
                개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </li>
              <li>
                각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                  <li>
                    <strong>회원가입 및 관리:</strong> 회원탈퇴 시까지. 다만, 다음의 사유에 해당하는 경우에는
                    해당 사유 종료 시까지
                    <ul className="list-none ml-4 mt-1 space-y-1 text-sm">
                      <li>- 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우: 해당 수사·조사 종료 시까지</li>
                      <li>- 서비스 이용에 따른 채권·채무관계 잔존 시: 해당 채권·채무관계 정산 시까지</li>
                    </ul>
                  </li>
                  <li>
                    <strong>재화 또는 서비스 제공:</strong> 재화·서비스 공급완료 및 요금결제·정산 완료 시까지.
                    다만, 관련 법령에 따라 다음과 같이 보유
                    <ul className="list-none ml-4 mt-1 space-y-1 text-sm">
                      <li>- 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                      <li>- 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
                      <li>- 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
                      <li>- 접속에 관한 기록: 3개월 (통신비밀보호법)</li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제4조 (개인정보의 제3자 제공)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 정보주체의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서만 처리하며,
                정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는
                경우에만 개인정보를 제3자에게 제공합니다.
              </li>
              <li>
                회사는 다음과 같이 개인정보를 제3자에게 제공하고 있습니다:
                <div className="ml-4 mt-2 p-4 bg-muted rounded-lg">
                  <p><strong>소셜 미디어 플랫폼 연동 시:</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>제공받는 자: TikTok, YouTube (Google), Instagram (Meta)</li>
                    <li>제공 목적: 콘텐츠 배포, 계정 연동</li>
                    <li>제공 항목: 연동에 필요한 계정 정보, 배포할 콘텐츠</li>
                    <li>보유 기간: 연동 해제 시까지</li>
                  </ul>
                </div>
              </li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제5조 (개인정보처리의 위탁)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:
                <div className="ml-4 mt-2 space-y-2">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>클라우드 서비스:</strong> Amazon Web Services (AWS), Vercel</p>
                    <p className="text-sm">위탁업무: 데이터 저장 및 서버 운영</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>결제 서비스:</strong> 해당 결제 대행사</p>
                    <p className="text-sm">위탁업무: 결제 처리 및 정산</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>AI 서비스:</strong> Google (Gemini API), OpenAI</p>
                    <p className="text-sm">위탁업무: AI 모델 처리</p>
                  </div>
                </div>
              </li>
              <li>
                회사는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 개인정보
                처리금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에
                관한 사항을 계약서 등 문서에 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하고
                있습니다.
              </li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제6조 (정보주체의 권리·의무 및 행사방법)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수
                있습니다.
              </li>
              <li>
                제1항에 따른 권리 행사는 회사에 대해 「개인정보 보호법」 시행령 제41조 제1항에 따라 서면,
                전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
              </li>
              <li>
                제1항에 따른 권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수
                있습니다.
              </li>
              <li>
                개인정보 열람 및 처리정지 요구는 「개인정보 보호법」 제35조 제4항, 제37조 제2항에 의하여
                정보주체의 권리가 제한될 수 있습니다.
              </li>
              <li>
                개인정보의 정정 및 삭제 요구는 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는
                경우에는 그 삭제를 요구할 수 없습니다.
              </li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제7조 (개인정보의 안전성 확보조치)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>관리적 조치:</strong> 내부관리계획 수립·시행, 개인정보 취급 직원의 최소화 및 교육
              </li>
              <li>
                <strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치,
                고유식별정보 등의 암호화, 보안프로그램 설치
              </li>
              <li>
                <strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제
              </li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제8조 (개인정보 자동 수집 장치의 설치·운영 및 거부)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는
                &apos;쿠키(cookie)&apos;를 사용합니다.
              </li>
              <li>
                쿠키는 웹사이트를 운영하는데 이용되는 서버(http)가 이용자의 컴퓨터 브라우저에게 보내는 소량의
                정보이며 이용자들의 PC 컴퓨터 내의 하드디스크에 저장되기도 합니다.
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>
                    쿠키의 사용목적: 이용자가 방문한 각 서비스와 웹 사이트들에 대한 방문 및 이용형태, 인기
                    검색어, 보안접속 여부 등을 파악하여 이용자에게 최적화된 정보 제공을 위해 사용됩니다.
                  </li>
                  <li>
                    쿠키의 설치·운영 및 거부: 웹브라우저 상단의 도구 &gt; 인터넷 옵션 &gt; 개인정보 메뉴의
                    옵션 설정을 통해 쿠키 저장을 거부할 수 있습니다.
                  </li>
                  <li>쿠키 저장을 거부할 경우 맞춤형 서비스 이용에 어려움이 발생할 수 있습니다.</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제9조 (개인정보 보호책임자)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리
              및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="p-4 bg-muted rounded-lg text-muted-foreground">
              <p><strong>개인정보 보호책임자</strong></p>
              <p className="mt-2">성명: 강지원</p>
              <p>직책: 대표이사</p>
              <p>연락처: 회사 대표 연락처</p>
            </div>
            <p className="text-muted-foreground mt-4">
              정보주체께서는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리,
              피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 회사는 정보주체의 문의에
              대해 지체 없이 답변 및 처리해 드릴 것입니다.
            </p>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제10조 (권익침해 구제방법)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원
              개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
              <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
              <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
              <li>경찰청: (국번없이) 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제11조 (개인정보 처리방침의 변경)</h2>
            <p className="text-muted-foreground leading-relaxed">
              이 개인정보 처리방침은 2024년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및
              정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>

          {/* 회사 정보 */}
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-semibold mb-4">회사 정보</h2>
            <div className="text-muted-foreground space-y-2">
              <p><strong>회사명:</strong> 이온스튜디오 주식회사</p>
              <p><strong>대표이사:</strong> 강지원</p>
              <p><strong>사업자등록번호:</strong> 440-81-02170</p>
              <p><strong>법인등록번호:</strong> 110111-8000319</p>
              <p><strong>주소:</strong> 서울특별시 강남구 봉은사로22길 45-9, 제44호실 (역삼동, 논스1호점)</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
