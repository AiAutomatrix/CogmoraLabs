
import { useEffect, useRef, useState, useMemo } from "react";
import type {
  IncomingKucoinWebSocketMessage,
  DisplayTickerData,
  KucoinRawTickerData,
  KucoinSubscribeMessage,
  KucoinPingMessage,
} from "@/types/websocket"; // Corrected import path

// Placeholder: In a real app, these would come from the /api/v1/bullet-public response
const PLACEHOLDER_WS_URL = "wss://ws-api.kucoin.com/endpoint"; // Replace with actual after token fetch
const SIMULATED_PING_INTERVAL = 18000; // e.g., 18 seconds from KuCoin docs
const SIMULATED_PING_TIMEOUT = 10000; // e.g., 10 seconds from KuCoin docs

export type WebSocketStatus =
  | 'idle'
  | 'connecting_token' // Simulating this state
  | 'connecting_ws'
  | 'connected_ws' // Connection open, pre-welcome
  | 'welcomed'       // Welcome message received
  | 'subscribing'
  | 'subscribed'
  | 'disconnected'
  | 'error';

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<{ [symbol: string]: DisplayTickerData }>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const currentSubscriptionId = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("WebSocket already open or opening.");
      return;
    }
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    console.log("Attempting to connect to KuCoin WebSocket...");
    setWebsocketStatus('connecting_ws'); // Simulating token already fetched

    // TODO: Implement actual REST API call to /api/v1/bullet-public to get token and endpoint
    // For now, using a placeholder URL. In a real scenario, this URL and the token
    // would be fetched dynamically.
    // const wsUrl = fetchedEndpointUrl + "?token=" + fetchedToken + "&connectId=" + Date.now();
    // For this example, we directly use a public KuCoin endpoint.
    // Note: Direct connection without a token to this public endpoint might not work for subscriptions.
    // The correct flow involves getting a token from /api/v1/bullet-public first.
    // This example uses a generic public endpoint for demonstration of WebSocket lifecycle.
    // For actual KuCoin /market/ticker:all, you MUST fetch a token.
    const wsUrl = "wss://ws-api-spot.kucoin.com/"; // This is a base, needs token from /bullet-public

    try {
      socketRef.current = new WebSocket(wsUrl);
    } catch (e) {
        console.error("WebSocket instantiation error:", e);
        setWebsocketStatus('error');
        scheduleReconnect();
        return;
    }


    socketRef.current.onopen = () => {
      console.log("WebSocket connection opened.");
      setWebsocketStatus('connected_ws'); // Connection is open, waiting for welcome.
    };

    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
        // console.log("WS Message Received:", message);

        switch (message.type) {
          case "welcome":
            console.log("KuCoin WebSocket Welcome:", message.id);
            setWebsocketStatus('welcomed');
            // Now subscribe to /market/ticker:all
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              currentSubscriptionId.current = Date.now();
              const subscribeMsg: KucoinSubscribeMessage = {
                id: currentSubscriptionId.current,
                type: "subscribe",
                topic: "/market/ticker:all",
                response: true,
              };
              socketRef.current.send(JSON.stringify(subscribeMsg));
              console.log("Sent subscription request for /market/ticker:all", subscribeMsg);
              setWebsocketStatus('subscribing');
              startPingPong();
            }
            break;

          case "ack":
            if (message.id === String(currentSubscriptionId.current)) {
                console.log("Subscription ACK received:", message);
                setWebsocketStatus('subscribed');
            } else {
                console.warn("Received ACK for unknown ID:", message);
            }
            break;

          case "pong":
            // console.log("Pong received:", message.id);
            if (pingTimeoutId.current) {
              clearTimeout(pingTimeoutId.current);
              pingTimeoutId.current = null;
            }
            break;

          case "message":
            if (message.topic === "/market/ticker:all") {
              const symbol = message.subject;
              const rawData = message.data;
              setTickers((prevTickers) => ({
                ...prevTickers,
                [symbol]: {
                  symbol: symbol,
                  price: parseFloat(rawData.price),
                  size: parseFloat(rawData.size),
                  bestAsk: parseFloat(rawData.bestAsk),
                  bestAskSize: parseFloat(rawData.bestAskSize),
                  bestBid: parseFloat(rawData.bestBid),
                  bestBidSize: parseFloat(rawData.bestBidSize),
                  sequence: rawData.sequence,
                  lastUpdate: new Date(rawData.Time),
                },
              }));
            }
            break;
          
          case "error":
            console.error("KuCoin WebSocket Error Message:", message);
            // Potentially handle specific error codes
            break;

          default:
            // console.warn("Unhandled KuCoin WebSocket message type:", message);
            break;
        }
      } catch (err) {
        console.error("Invalid WebSocket message or parsing error:", event.data, err);
      }
    };

    socketRef.current.onerror = (event) => {
      console.error("WebSocket error event. Event object:", event);
      setWebsocketStatus('error');
      // Connection will likely close, onclose will handle reconnect
    };

    socketRef.current.onclose = (event) => {
      console.warn(`WebSocket closed. Code: ${event.code}, Reason: "${event.reason || 'No reason'}". WasClean: ${event.wasClean}`);
      setWebsocketStatus('disconnected');
      stopPingPong();
      if (!event.wasClean) { // Reconnect if not a clean closure
        scheduleReconnect();
      }
    };
  }, []);

  const scheduleReconnect = () => {
    if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
    }
    console.log("Scheduling reconnect in 5s...");
    reconnectTimeoutId.current = setTimeout(() => {
        connect();
    }, 5000); // Reconnect after 5 seconds
  }

  const startPingPong = () => {
    stopPingPong(); // Clear existing timers
    // console.log(`Starting ping interval: ${SIMULATED_PING_INTERVAL}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now(), type: "ping" };
        // console.log("Sending PING:", pingMsg);
        socketRef.current.send(JSON.stringify(pingMsg));

        // Set a timeout for the pong
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("Ping timeout! No pong received. Closing WebSocket.");
          socketRef.current?.close(1000, "Ping timeout"); // Close and trigger onclose for reconnect
        }, SIMULATED_PING_TIMEOUT);
      }
    }, SIMULATED_PING_INTERVAL);
  };

  const stopPingPong = () => {
    if (pingIntervalId.current) {
      clearInterval(pingIntervalId.current);
      pingIntervalId.current = null;
    //   console.log("Stopped ping interval.");
    }
    if (pingTimeoutId.current) {
      clearTimeout(pingTimeoutId.current);
      pingTimeoutId.current = null;
    }
  };

  useEffect(() => {
    // TODO: Add logic here to first fetch the /api/v1/bullet-public token
    // then call connect() with the received endpoint and token.
    // For now, we call connect directly.
    connect();

    return () => {
      console.log("Closing WebSocket connection from useEffect cleanup.");
      stopPingPong();
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
      }
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounting");
        socketRef.current = null;
      }
      setWebsocketStatus('idle');
    };
  }, [connect]);

  const processedTickers = useMemo(() => Object.values(tickers).sort((a,b) => a.symbol.localeCompare(b.symbol)), [tickers]);

  return { processedTickers, websocketStatus };
}
