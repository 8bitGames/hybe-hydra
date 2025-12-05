"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">{legal.privacy.title}</h1>
        <p className="text-muted-foreground mb-8">
          {legal.common.lastModified}: {new Date().toLocaleDateString(language === "ko" ? "ko-KR" : "en-US")}
        </p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          {/* Intro */}
          <section>
            <p className="text-muted-foreground leading-relaxed">
              {legal.privacy.intro}
            </p>
          </section>

          {/* Article 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article1.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.privacy.article1.intro}
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                <strong>{legal.privacy.article1.purpose1.title}</strong>
                <p className="ml-6 mt-1">
                  {legal.privacy.article1.purpose1.content}
                </p>
              </li>
              <li>
                <strong>{legal.privacy.article1.purpose2.title}</strong>
                <p className="ml-6 mt-1">
                  {legal.privacy.article1.purpose2.content}
                </p>
              </li>
              <li>
                <strong>{legal.privacy.article1.purpose3.title}</strong>
                <p className="ml-6 mt-1">
                  {legal.privacy.article1.purpose3.content}
                </p>
              </li>
              <li>
                <strong>{legal.privacy.article1.purpose4.title}</strong>
                <p className="ml-6 mt-1">
                  {legal.privacy.article1.purpose4.content}
                </p>
              </li>
            </ol>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article2.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.privacy.article2.intro}
            </p>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <strong>1. {legal.privacy.article2.category1.title}</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.privacy.article2.category1.required}</li>
                  <li>{legal.privacy.article2.category1.optional}</li>
                </ul>
              </div>
              <div>
                <strong>2. {legal.privacy.article2.category2.title}</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.privacy.article2.category2.item1}</li>
                  <li>{legal.privacy.article2.category2.item2}</li>
                  <li>{legal.privacy.article2.category2.item3}</li>
                  <li>{legal.privacy.article2.category2.item4}</li>
                </ul>
              </div>
              <div>
                <strong>3. {legal.privacy.article2.category3.title}</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.privacy.article2.category3.item1}</li>
                  <li>{legal.privacy.article2.category3.item2}</li>
                  <li>{legal.privacy.article2.category3.item3}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article3.title}</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                {legal.privacy.article3.item1}
              </li>
              <li>
                {legal.privacy.article3.item2intro}
                <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                  <li>
                    <strong>{legal.privacy.article3.retention1.title}</strong> {legal.privacy.article3.retention1.content}
                    <ul className="list-none ml-4 mt-1 space-y-1 text-sm">
                      <li>- {legal.privacy.article3.retention1.sub1}</li>
                      <li>- {legal.privacy.article3.retention1.sub2}</li>
                    </ul>
                  </li>
                  <li>
                    <strong>{legal.privacy.article3.retention2.title}</strong> {legal.privacy.article3.retention2.content}
                    <ul className="list-none ml-4 mt-1 space-y-1 text-sm">
                      <li>- {legal.privacy.article3.retention2.sub1}</li>
                      <li>- {legal.privacy.article3.retention2.sub2}</li>
                      <li>- {legal.privacy.article3.retention2.sub3}</li>
                      <li>- {legal.privacy.article3.retention2.sub4}</li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article4.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                {legal.privacy.article4.item1}
              </li>
              <li>
                {legal.privacy.article4.item2intro}
                <div className="ml-4 mt-2 p-4 bg-muted rounded-lg">
                  <p><strong>{legal.privacy.article4.socialMedia.title}</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>{legal.privacy.article4.socialMedia.recipient}</li>
                    <li>{legal.privacy.article4.socialMedia.purpose}</li>
                    <li>{legal.privacy.article4.socialMedia.items}</li>
                    <li>{legal.privacy.article4.socialMedia.retention}</li>
                  </ul>
                </div>
              </li>
            </ol>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article5.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                {legal.privacy.article5.item1intro}
                <div className="ml-4 mt-2 space-y-2">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>{legal.privacy.article5.cloud.title}</strong> {legal.privacy.article5.cloud.provider}</p>
                    <p className="text-sm">{legal.privacy.article5.cloud.task}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>{legal.privacy.article5.payment.title}</strong> {legal.privacy.article5.payment.provider}</p>
                    <p className="text-sm">{legal.privacy.article5.payment.task}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm"><strong>{legal.privacy.article5.ai.title}</strong> {legal.privacy.article5.ai.provider}</p>
                    <p className="text-sm">{legal.privacy.article5.ai.task}</p>
                  </div>
                </div>
              </li>
              <li>
                {legal.privacy.article5.item2}
              </li>
            </ol>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article6.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{legal.privacy.article6.item1}</li>
              <li>{legal.privacy.article6.item2}</li>
              <li>{legal.privacy.article6.item3}</li>
              <li>{legal.privacy.article6.item4}</li>
              <li>{legal.privacy.article6.item5}</li>
            </ol>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article7.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.privacy.article7.intro}
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <strong>{legal.privacy.article7.measure1.title}</strong> {legal.privacy.article7.measure1.content}
              </li>
              <li>
                <strong>{legal.privacy.article7.measure2.title}</strong> {legal.privacy.article7.measure2.content}
              </li>
              <li>
                <strong>{legal.privacy.article7.measure3.title}</strong> {legal.privacy.article7.measure3.content}
              </li>
            </ol>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article8.title}</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                {legal.privacy.article8.item1}
              </li>
              <li>
                {legal.privacy.article8.item2intro}
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>{legal.privacy.article8.cookiePurpose}</li>
                  <li>{legal.privacy.article8.cookieSettings}</li>
                  <li>{legal.privacy.article8.cookieWarning}</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article9.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.privacy.article9.intro}
            </p>
            <div className="p-4 bg-muted rounded-lg text-muted-foreground">
              <p><strong>{legal.privacy.article9.officer}</strong></p>
              <p className="mt-2">{legal.privacy.article9.name}</p>
              <p>{legal.privacy.article9.position}</p>
              <p>{legal.privacy.article9.contact}</p>
            </div>
            <p className="text-muted-foreground mt-4">
              {legal.privacy.article9.outro}
            </p>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article10.title}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {legal.privacy.article10.intro}
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>{legal.privacy.article10.agency1}</li>
              <li>{legal.privacy.article10.agency2}</li>
              <li>{legal.privacy.article10.agency3}</li>
              <li>{legal.privacy.article10.agency4}</li>
            </ul>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">{legal.privacy.article11.title}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {legal.privacy.article11.content}
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
