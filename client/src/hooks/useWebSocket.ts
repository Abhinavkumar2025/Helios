import { useEffect, useRef, useState, useCallback } from "react";
import { getWsUrl } from "../services/api";
import { WebSocketEvent } from "../types";

type EventHandler = (data: any) => void;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<any>(null);

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(handler);

    return () => {
      listenersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(parsed);

          // Dispatch to specific listeners
          const handlers = listenersRef.current.get(parsed.type);
          if (handlers) {
            handlers.forEach((h) => h(parsed.data));
          }

          // Wildcard listener
          const allHandlers = listenersRef.current.get("*");
          if (allHandlers) {
            allHandlers.forEach((h) => h(parsed));
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3s
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
        ws.close();
      };
    } catch (e) {
      console.error("Failed to connect WebSocket:", e);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "ping" }));
    }
  }, []);

  return {
    isConnected,
    lastEvent,
    subscribe,
    sendPing,
  };
}
