'use client';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-xl p-6 max-w-sm w-[90%] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-ink leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-card border border-border rounded-lg text-sm text-ink-light hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
