"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold mb-2">이용약관</h1>
        <p className="text-muted-foreground mb-8">
          최종 수정일: {new Date().toLocaleDateString("ko-KR")}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          {/* 제1조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제1조 (목적)</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 약관은 이온스튜디오 주식회사(이하 &quot;회사&quot;)가 제공하는 AI 기반 비디오 생성 플랫폼 서비스
              &quot;Hydra&quot;(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항,
              기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제2조 (정의)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                &quot;서비스&quot;란 회사가 제공하는 AI 기반 비디오 생성, 트렌드 분석, 콘텐츠 관리, 멀티플랫폼 배포 등
                일체의 서비스를 의미합니다.
              </li>
              <li>
                &quot;이용자&quot;란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.
              </li>
              <li>
                &quot;회원&quot;이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로
                제공받으며, 회사가 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
              </li>
              <li>
                &quot;콘텐츠&quot;란 이용자가 서비스를 통해 생성, 업로드, 저장하는 모든 형태의 비디오, 이미지,
                텍스트, 오디오 등의 자료를 의미합니다.
              </li>
              <li>
                &quot;AI 생성물&quot;이란 서비스의 인공지능 기술을 활용하여 자동으로 생성된 비디오, 이미지,
                텍스트 등의 결과물을 의미합니다.
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.</li>
              <li>
                회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경된
                약관은 서비스 내 공지사항에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이
                발생합니다.
              </li>
              <li>
                회원은 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원탈퇴를 요청할 수 있으며,
                변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용할 경우 약관의 변경사항에 동의한 것으로
                간주합니다.
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제4조 (서비스의 제공)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              회사는 다음과 같은 서비스를 제공합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>AI 기반 비디오 자동 생성 서비스</li>
              <li>실시간 트렌드 분석 및 인사이트 제공</li>
              <li>멀티플랫폼 콘텐츠 배포 서비스 (TikTok, YouTube, Instagram 등)</li>
              <li>캠페인 관리 및 분석 도구</li>
              <li>에셋 라이브러리 및 템플릿 제공</li>
              <li>초개인화 콘텐츠 생성 기능</li>
              <li>다국어 현지화 지원</li>
              <li>기타 회사가 정하는 서비스</li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제5조 (회원가입)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                이용자는 회사가 정한 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로써
                회원가입을 신청합니다.
              </li>
              <li>
                회사는 전항에 따라 회원가입을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로
                등록합니다.
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                  <li>기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우</li>
                </ul>
              </li>
              <li>
                회원가입계약의 성립시기는 회사의 승낙이 회원에게 도달한 시점으로 합니다.
              </li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제6조 (회원정보의 변경)</h2>
            <p className="text-muted-foreground leading-relaxed">
              회원은 개인정보관리 화면을 통하여 언제든지 자신의 개인정보를 열람하고 수정할 수 있습니다.
              회원은 회원가입 시 기재한 사항이 변경되었을 경우 서비스 내에서 직접 수정하거나 고객센터를 통해
              회사에 변경사항을 알려야 합니다.
            </p>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제7조 (회원탈퇴 및 자격상실)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회원은 언제든지 서비스 내 회원탈퇴 기능 또는 고객센터를 통해 탈퇴를 요청할 수 있으며, 회사는
                즉시 회원탈퇴를 처리합니다.
              </li>
              <li>
                회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                  <li>서비스를 이용하여 구입한 재화 등의 대금, 기타 서비스 이용에 관련하여 회원이 부담하는 채무를 기일에 지급하지 않는 경우</li>
                  <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자거래질서를 위협하는 경우</li>
                  <li>서비스를 이용하여 법령과 본 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제8조 (이용자의 의무)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              이용자는 다음 행위를 하여서는 안 됩니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>신청 또는 변경 시 허위내용의 등록</li>
              <li>타인의 정보 도용</li>
              <li>회사가 게시한 정보의 변경</li>
              <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등)의 송신 또는 게시</li>
              <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
              <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
              <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
              <li>서비스를 통해 불법적인 콘텐츠를 생성하거나 배포하는 행위</li>
              <li>AI 생성물을 허위정보 생성 또는 유포 목적으로 사용하는 행위</li>
              <li>타인의 초상권, 인격권을 침해하는 콘텐츠를 생성하는 행위</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제9조 (콘텐츠 및 AI 생성물의 권리)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                이용자가 업로드한 원본 콘텐츠의 저작권은 해당 이용자에게 귀속됩니다.
              </li>
              <li>
                서비스를 통해 생성된 AI 생성물에 대한 권리는 관련 법령 및 별도의 계약에 따릅니다. 단, 이용자는
                서비스 이용 목적 범위 내에서 AI 생성물을 자유롭게 사용할 수 있습니다.
              </li>
              <li>
                회사는 서비스 품질 향상 및 AI 모델 개선을 위해 익명화된 형태로 이용자의 콘텐츠 사용 패턴을
                분석할 수 있습니다.
              </li>
              <li>
                이용자는 본 서비스를 통해 생성한 콘텐츠가 제3자의 권리를 침해하지 않도록 해야 하며, 이로 인해
                발생하는 모든 책임은 이용자에게 있습니다.
              </li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제10조 (서비스 이용제한)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 이용자가 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 서비스
                이용을 경고, 일시정지, 영구이용정지 등으로 단계적으로 제한할 수 있습니다.
              </li>
              <li>
                회사는 전항에도 불구하고, 저작권법 및 컴퓨터프로그램보호법을 위반한 불법프로그램의 제공 및
                운영방해, 정보통신망법을 위반한 불법통신 및 해킹, 악성프로그램의 배포, 접속권한 초과행위 등과
                같이 관련법을 위반한 경우에는 즉시 영구이용정지를 할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제11조 (서비스의 중단)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우
                서비스의 제공을 일시적으로 중단할 수 있습니다.
              </li>
              <li>
                회사는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은
                손해에 대하여 배상합니다. 단, 회사에 고의 또는 과실이 없는 경우에는 그러하지 아니합니다.
              </li>
            </ol>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제12조 (면책조항)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스
                제공에 관한 책임이 면제됩니다.
              </li>
              <li>
                회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.
              </li>
              <li>
                AI 생성물의 정확성, 적합성에 대해 회사는 보증하지 않으며, 이용자는 생성된 콘텐츠를 검토 후
                사용해야 합니다.
              </li>
              <li>
                회사는 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 상실한 것에 대하여 책임을 지지
                않습니다.
              </li>
            </ol>
          </section>

          {/* 제13조 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">제13조 (분쟁해결)</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위해
                피해보상처리기구를 설치 운영합니다.
              </li>
              <li>
                회사와 이용자 간에 발생한 분쟁은 대한민국 법을 준거법으로 하며, 분쟁에 관한 소송은 서울중앙지방법원을 관할법원으로 합니다.
              </li>
            </ol>
          </section>

          {/* 부칙 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">부칙</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 약관은 2024년 1월 1일부터 시행됩니다.
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
