// The dashboard shows the full gameweek timeline card, so it skips the strip.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-7 lg:p-8 overflow-x-clip">
      {children}
    </main>
  );
}
