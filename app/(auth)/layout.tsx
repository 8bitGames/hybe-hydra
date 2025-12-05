import { AuthI18nWrapper } from "./i18n-wrapper";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthI18nWrapper>{children}</AuthI18nWrapper>;
}
