export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        body {
          background: #000 !important;
        }
      `}</style>
      <div className="min-h-screen bg-black">
        {children}
      </div>
    </>
  );
}
