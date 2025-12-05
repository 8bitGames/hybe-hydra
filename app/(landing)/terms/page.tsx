"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export default function TermsPage() {
  const { t, language } = useI18n();
  const legal = t.legal;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{legal.common.backToHome}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">{legal.terms.title}</h1>
        <p className="text-muted-foreground mb-8">
          {legal.common.lastModified}: {new Date().toLocaleDateString(language === "ko" ? "ko-KR" : "en-US")}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          {/* Article 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article1.title}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {legal.terms.article1.content}
            </p>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article2.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article2.item1}</li>
              <li>{legal.terms.article2.item2}</li>
              <li>{legal.terms.article2.item3}</li>
              <li>{legal.terms.article2.item4}</li>
              <li>{legal.terms.article2.item5}</li>
            </ol>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article3.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article3.item1}</li>
              <li>{legal.terms.article3.item2}</li>
              <li>{legal.terms.article3.item3}</li>
            </ol>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article4.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.terms.article4.intro}
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article4.item1}</li>
              <li>{legal.terms.article4.item2}</li>
              <li>{legal.terms.article4.item3}</li>
              <li>{legal.terms.article4.item4}</li>
              <li>{legal.terms.article4.item5}</li>
              <li>{legal.terms.article4.item6}</li>
              <li>{legal.terms.article4.item7}</li>
              <li>{legal.terms.article4.item8}</li>
            </ol>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article5.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article5.item1}</li>
              <li>
                {legal.terms.article5.item2}
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.terms.article5.item2sub1}</li>
                  <li>{legal.terms.article5.item2sub2}</li>
                </ul>
              </li>
              <li>{legal.terms.article5.item3}</li>
            </ol>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article6.title}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {legal.terms.article6.content}
            </p>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article7.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article7.item1}</li>
              <li>
                {legal.terms.article7.item2}
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.terms.article7.item2sub1}</li>
                  <li>{legal.terms.article7.item2sub2}</li>
                  <li>{legal.terms.article7.item2sub3}</li>
                  <li>{legal.terms.article7.item2sub4}</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article8.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.terms.article8.intro}
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article8.item1}</li>
              <li>{legal.terms.article8.item2}</li>
              <li>{legal.terms.article8.item3}</li>
              <li>{legal.terms.article8.item4}</li>
              <li>{legal.terms.article8.item5}</li>
              <li>{legal.terms.article8.item6}</li>
              <li>{legal.terms.article8.item7}</li>
              <li>{legal.terms.article8.item8}</li>
              <li>{legal.terms.article8.item9}</li>
              <li>{legal.terms.article8.item10}</li>
            </ol>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article9.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article9.item1}</li>
              <li>{legal.terms.article9.item2}</li>
              <li>{legal.terms.article9.item3}</li>
              <li>{legal.terms.article9.item4}</li>
            </ol>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article10.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article10.item1}</li>
              <li>{legal.terms.article10.item2}</li>
            </ol>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article11.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article11.item1}</li>
              <li>{legal.terms.article11.item2}</li>
            </ol>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article12.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article12.item1}</li>
              <li>{legal.terms.article12.item2}</li>
              <li>{legal.terms.article12.item3}</li>
              <li>{legal.terms.article12.item4}</li>
            </ol>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.article13.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.terms.article13.item1}</li>
              <li>{legal.terms.article13.item2}</li>
            </ol>
          </section>

          {/* Addendum */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.terms.addendum.title}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {legal.common.effectiveDate}
            </p>
          </section>

          {/* Company Info */}
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-semibold mb-4">{legal.common.companyInfo}</h2>
            <div className="text-muted-foreground space-y-2">
              <p><strong>{legal.common.companyName}:</strong> {legal.common.companyNameValue}</p>
              <p><strong>{legal.common.ceo}:</strong> {legal.common.ceoValue}</p>
              <p><strong>{legal.common.businessNumber}:</strong> {legal.common.businessNumberValue}</p>
              <p><strong>{legal.common.corporateNumber}:</strong> {legal.common.corporateNumberValue}</p>
              <p><strong>{legal.common.address}:</strong> {legal.common.addressValue}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
