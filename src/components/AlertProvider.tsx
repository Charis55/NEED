"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type AlertType = "success" | "error" | "info";

interface AlertMessage {
  id: string;
  type: AlertType;
  message: string;
  action?: { label?: string; onClick: () => void };
  avatarUrl?: string;
}

interface AlertContextType {
  showAlert: (message: string, type: AlertType, action?: { label?: string; onClick: () => void }, avatarUrl?: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  const showAlert = useCallback((message: string, type: AlertType, action?: { label?: string; onClick: () => void }, avatarUrl?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlerts((prev) => [...prev, { id, type, message, action, avatarUrl }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, 4000);
  }, []);

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const getAlertStyles = (type: AlertType) => {
    switch (type) {
      case "success":
        return { bg: "bg-[var(--color-brutal-green)]", icon: CheckCircle };
      case "error":
        return { bg: "bg-[var(--color-brutal-red)]", icon: AlertCircle };
      case "info":
        return { bg: "bg-[var(--color-brutal-blue)]", icon: Info };
      default:
        return { bg: "bg-white", icon: Info };
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-4 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {alerts.map((alert) => {
            const { bg, icon: Icon } = getAlertStyles(alert.type);
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className={`${bg} border-4 border-black p-4 brutal-shadow flex items-start justify-between pointer-events-auto ${alert.action ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""}`}
                onClick={alert.action ? () => { alert.action?.onClick(); removeAlert(alert.id); } : undefined}
              >
                <div className="flex items-center gap-3">
                  {alert.avatarUrl ? (
                    <img src={alert.avatarUrl} alt="Avatar" className="w-10 h-10 border-2 border-black object-cover bg-white shrink-0" />
                  ) : (
                    <Icon className="w-6 h-6 stroke-[3] text-black shrink-0" />
                  )}
                  <p className="font-black uppercase text-black text-sm leading-tight">{alert.message}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeAlert(alert.id); }}
                  className="w-6 h-6 bg-white border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors shrink-0 ml-4"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AlertContext.Provider>
  );
}
