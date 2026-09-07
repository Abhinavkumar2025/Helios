import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { Incident, SOSEvent, WebSocketEvent } from "../types";

interface WebSocketContextType {
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  sendPing: () => void;
  activeEmergency: { incident: Incident; sos: SOSEvent } | null;
  dismissEmergency: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ws = useWebSocket();
  const [activeEmergency, setActiveEmergency] = useState<{ incident: Incident; sos: SOSEvent } | null>(null);

  useEffect(() => {
    // Listen for critical SOS creations
    const unsubSOS = ws.subscribe("sos_created", (data: SOSEvent) => {
      if (data && data.incident) {
        setActiveEmergency({
          incident: data.incident,
          sos: data,
        });
      }
    });

    return () => {
      unsubSOS();
    };
  }, [ws]);

  const dismissEmergency = () => {
    setActiveEmergency(null);
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected: ws.isConnected,
        lastEvent: ws.lastEvent,
        subscribe: ws.subscribe,
        sendPing: ws.sendPing,
        activeEmergency,
        dismissEmergency,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export function useHeliosWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useHeliosWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
