
import { useEffect, useRef, useState } from "react";
import type { OpportunityMessage, OpportunityPayload } from "@/types/websocket"; // Corrected import path

export function useOpportunitySocket() {
  const [opportunities, setOpportunities] = useState<OpportunityPayload[]>([]);
  const [websocketStatus, setWebsocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      // Ensure WebSocket is only created in the browser
      if (typeof window === 'undefined') {
        return;
      }
      
      // Prevent multiple connections
      if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
        // console.log("WebSocket already open or opening.");
        return;
      }

      setWebsocketStatus('connecting');
      socketRef.current = new WebSocket("wss://your.server/ws/opportunities"); // Placeholder URL

      socketRef.current.onopen = () => {
        console.log("WebSocket connected");
        setWebsocketStatus('connected');
        // You might want to send an initial message or authentication here if needed
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message: OpportunityMessage = JSON.parse(event.data as string);

          switch (message.type) {
            case "new_opportunity":
              setOpportunities((prev) => [...prev, message.payload]);
              break;

            case "opportunity_update":
              setOpportunities((prev) =>
                prev.map((opp) =>
                  opp.id === message.payload.id ? message.payload : opp
                )
              );
              break;

            case "remove_opportunity":
              setOpportunities((prev) =>
                prev.filter((opp) => opp.id !== message.payload.id)
              );
              break;
            
            case "heartbeat":
              // console.log("Heartbeat received:", message.timestamp);
              // Optionally, send a pong back or reset a client-side timeout
              break;
            
            case "error":
              console.error("WebSocket error message from server:", message.message);
              setWebsocketStatus('error'); // Could be a specific app-level error
              break;

            default:
              // Using a type assertion to handle potential unknown message types
              const unknownMessage = message as { type: string };
              console.warn("Unhandled message type:", unknownMessage.type, message);
              break;
          }
        } catch (err) {
          console.error("Invalid WebSocket message or parsing error:", event.data, err);
        }
      };

      socketRef.current.onerror = (event) => {
        console.error("WebSocket error event:", event);
        setWebsocketStatus('error');
      };

      socketRef.current.onclose = (event) => {
        console.warn("WebSocket closed. Reconnecting...", event.reason, `Code: ${event.code}`);
        setWebsocketStatus('disconnected');
        // Implement a more robust reconnection strategy, e.g., with backoff
        // Avoid reconnecting if explicitly closed by the component cleanup
        if (socketRef.current && event.wasClean === false) { // Check if closure was not initiated by client
            setTimeout(connect, 3000); 
        }
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        console.log("Closing WebSocket connection explicitly.");
        // Set a flag or use a different method to prevent onclose from auto-reconnecting
        const ws = socketRef.current;
        socketRef.current = null; // Prevent onclose from finding a ref and reconnecting
        ws.close(1000, "Component unmounting"); 
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return { opportunities, websocketStatus };
}
