import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ConfirmDialog } from "./ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ToastItem = {
  id: number;
  message: string;
};

type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notifySuccess: (message: string) => void;
};

const FeedbackContext = createContext<FeedbackContextValue>({
  confirm: async ({ title, description }) => {
    if (typeof window === "undefined") {
      return true;
    }

    const prompt = description ? `${title}\n\n${description}` : title;
    return window.confirm(prompt);
  },
  notifySuccess: () => undefined,
});

type PendingConfirmation = ConfirmOptions & {
  resolve: (result: boolean) => void;
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastIdRef = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirmation({
        ...options,
        resolve,
      });
    });
  }, []);

  const closeConfirmation = useCallback((result: boolean) => {
    setPendingConfirmation((currentConfirmation) => {
      if (currentConfirmation) {
        currentConfirmation.resolve(result);
      }
      return null;
    });
  }, []);

  const notifySuccess = useCallback((message: string) => {
    const nextId = nextToastIdRef.current + 1;
    nextToastIdRef.current = nextId;

    setToasts((currentToasts) => [...currentToasts, { id: nextId, message }]);
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== nextId));
    }, 3200);
  }, []);

  const contextValue = useMemo(
    () => ({
      confirm,
      notifySuccess,
    }),
    [confirm, notifySuccess],
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast toast-success" role="status">
            <strong>Hecho</strong>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={pendingConfirmation !== null}
        title={pendingConfirmation?.title ?? ""}
        description={pendingConfirmation?.description}
        confirmLabel={pendingConfirmation?.confirmLabel}
        cancelLabel={pendingConfirmation?.cancelLabel}
        tone={pendingConfirmation?.tone}
        onCancel={() => closeConfirmation(false)}
        onConfirm={() => closeConfirmation(true)}
      />
    </FeedbackContext.Provider>
  );
}

export function useConfirm() {
  return useContext(FeedbackContext).confirm;
}

export function useToast() {
  return {
    notifySuccess: useContext(FeedbackContext).notifySuccess,
  };
}
