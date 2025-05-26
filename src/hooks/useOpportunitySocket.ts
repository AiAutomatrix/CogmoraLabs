
import { useEffect, useRef, useState } from "react";
import type { OpportunityMessage, OpportunityPayload } from "@/types/websocket"; // Corrected import path

export function useOpportunitySocket() {
  const [opportunities, setOpportunities] = useState<OpportunityPayload[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      // Ensure WebSocket is only created in the browser
      if (typeof window === 'undefined') {
        return;
      }
      socketRef.current = new WebSocket("wss://your.server/ws/opportunities"); // Placeholder URL

      socketRef.current.onopen = () => {
        console.log("WebSocket connected");
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
              // Handle specific error messages if needed
              break;

            default:
              // console.warn("Unhandled message type:", message);
              // Using a type assertion to handle potential unknown message types
              const unknownMessage = message as { type: string };
              console.warn("Unhandled message type:", unknownMessage.type);
              break;
          }
        } catch (err) {
          console.error("Invalid WebSocket message or parsing error:", event.data, err);
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Optionally, you could try to reconnect here or show an error state
      };

      socketRef.current.onclose = (event) => {
        console.warn("WebSocket closed. Reconnecting...", event.reason);
        // Implement a more robust reconnection strategy, e.g., with backoff
        setTimeout(connect, 3000); 
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        console.log("Closing WebSocket connection");
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return { opportunities };
}
