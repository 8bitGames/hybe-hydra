export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="space-y-6 pb-8 px-[7%]">
      {children}
    </div>
  );
}
