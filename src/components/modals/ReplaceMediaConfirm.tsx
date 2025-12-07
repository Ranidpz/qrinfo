'use client';

import { X, AlertTriangle, FileText, Image, Video } from 'lucide-react';

interface ReplaceMediaConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentMediaType?: string;
  currentFileName?: string;
  newFileName?: string;
  mediaCount?: number; // Number of media items in the code
}

export default function ReplaceMediaConfirm({
  isOpen,
  onClose,
  onConfirm,
  currentMediaType,
  currentFileName,
  newFileName,
  mediaCount = 1,
}: ReplaceMediaConfirmProps) {
  if (!isOpen) return null;

  const getMediaIcon = (type?: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      default:
        return <Image className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">החלפת מדיה</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {mediaCount > 1 ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-text-primary text-sm">
                <span className="font-semibold">שים לב:</span> בחוויה זו יש{' '}
                <span className="font-semibold text-amber-500">{mediaCount} פריטי מדיה</span>.
                הקובץ החדש ידרוס את הראשון שבהם.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {currentFileName && (
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                  {getMediaIcon(currentMediaType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">קובץ נוכחי (יימחק)</p>
                  <p className="text-sm text-text-primary truncate" dir="ltr">
                    {currentFileName}
                  </p>
                </div>
              </div>
            )}

            {newFileName && (
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">קובץ חדש</p>
                  <p className="text-sm text-text-primary truncate" dir="ltr">
                    {newFileName}
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-text-secondary text-center">
            האם אתה בטוח שברצונך להחליף את הקובץ?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1"
          >
            ביטול
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1"
          >
            החלף קובץ
          </button>
        </div>
      </div>
    </div>
  );
}
