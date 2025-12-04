'use client';

interface StorageBarProps {
  used: number;  // bytes
  limit: number; // bytes
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function StorageBar({ used, limit }: StorageBarProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const remaining = limit - used;

  // Color based on usage
  let barColor = 'bg-accent';
  if (percentage > 90) {
    barColor = 'bg-danger';
  } else if (percentage > 75) {
    barColor = 'bg-warning';
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">נפח אחסון</span>
        <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
      </div>

      <div className="flex items-center gap-3 text-sm text-text-secondary mb-2">
        <span>
          בשימוש: {formatBytes(used)} / {formatBytes(limit)}
        </span>
        <span className="text-accent">
          נותר: {formatBytes(remaining)}
        </span>
      </div>

      <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500 ${percentage > 75 ? 'storage-bar-animated' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
