export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto w-full py-8 animate-pulse flex flex-col gap-8">
      {/* Skeleton Header */}
      <div className="h-12 bg-slate-200 rounded-lg w-1/3"></div>
      
      {/* Skeleton Content Area (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-48 bg-slate-200 rounded-xl"></div>
        <div className="h-48 bg-slate-200 rounded-xl"></div>
        <div className="h-48 bg-slate-200 rounded-xl"></div>
      </div>
      
      {/* Skeleton Table / List Area */}
      <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
    </div>
  );
}