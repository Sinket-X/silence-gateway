import type { ReactNode } from "react";
import { X, AlertCircle } from "lucide-react";

interface ConfirmDeleteModalProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDeleteModal({
  title,
  description,
  onConfirm,
  onCancel,
  isLoading
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={onCancel}>
      <div 
        className="modal w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive ring-1 ring-destructive/30">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h1>{title}</h1>
          </div>
          <button onClick={onCancel} className="close-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="header-divider" />
        
        <div className="modal-body py-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        
        <div className="flex items-center gap-3 border-t border-border bg-muted/30 p-4 mt-auto">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
