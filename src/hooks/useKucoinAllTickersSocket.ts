
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type {
  IncomingKucoinWebSocketMessage,
  DisplayTickerData,
  KucoinSubscribeMessage,
  KucoinPingMessage,
  WebSocketStatus,
} from "@/types/websocket";

const PLACEHOLDER_WS_URL = "wss://ws-api-spot.kucoin.com/";
const SIMULATED_PING_INTERVAL = 18000;
const SIMULATED_PING_TIMEOUT = 10000;
const RECONNECT_DELAY = 5000;

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

    console.log("Attempting to connect to KuCoin WebSocket for all tickers...");
    // TODO: Implement actual token fetching from KuCoin's /api/v1/bullet-public
    // For now, using placeholder URL.
    // const wsUrl = actualEndpoint + "?token=" + actualToken + "&connectId=" + Date.now();
    const wsUrl = PLACEHOLDER_WS_URL;
    setWebsocketStatus('connecting_ws');

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
      setWebsocketStatus('connected_ws'); // Indicates WS is open, waiting for welcome
      // Welcome message from server will trigger subscription
    };

    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
        // console.log("WS Message Received:", message.type, message);

        switch (message.type) {
          case "welcome":
            console.log("KuCoin WebSocket Welcome:", message.id);
            setWebsocketStatus('welcomed');
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
             if (message.id && String(message.id) === String(currentSubscriptionId.current)) {
                console.log("Subscription ACK received for /market/ticker:all");
                setWebsocketStatus('subscribed');
            } else {
                console.warn("Received ACK for unknown or mismatched ID:", message);
            }
            break;

          case "pong":
            if (pingTimeoutId.current) {
              clearTimeout(pingTimeoutId.current);
              pingTimeoutId.current = null;
            }
            break;

          case "message":
            if (message.topic === "/market/ticker:all" && message.subject && message.data) {
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
            console.error("KuCoin WebSocket Error Message Received:", message);
            setWebsocketStatus('error');
            break;

          default:
            // console.warn("Unhandled KuCoin WebSocket message type:", message);
            break;
        }
      } catch (err) {
        console.error("Invalid WebSocket message or parsing error:", event.data, err);
      }
    };

    socketRef.current.onerror = (event: Event) => {
      console.error(`WebSocket error event of type: ${event.type}. Check network tab or WebSocket connection details for more info.`);
      setWebsocketStatus('error');
      // Connection will likely close, onclose will handle reconnect
    };

    socketRef.current.onclose = (event: CloseEvent) => {
      console.warn(`WebSocket closed. Code: ${event.code}, Reason: "${event.reason || 'No reason'}". WasClean: ${event.wasClean}`);
      setWebsocketStatus('disconnected');
      stopPingPong();
      if (!event.wasClean && event.code !== 1000 /* 1000 is normal closure */) {
        scheduleReconnect();
      }
    };
  }, []);

  const scheduleReconnect = () => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }
    console.log(`Scheduling reconnect in ${RECONNECT_DELAY / 1000}s...`);
    reconnectTimeoutId.current = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  };

  const startPingPong = () => {
    stopPingPong();
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now(), type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("Ping timeout! No pong received. Closing WebSocket.");
          socketRef.current?.close(1000, "Ping timeout");
        }, SIMULATED_PING_TIMEOUT);
      }
    }, SIMULATED_PING_INTERVAL);
  };

  const stopPingPong = () => {
    if (pingIntervalId.current) {
      clearInterval(pingIntervalId.current);
      pingIntervalId.current = null;
    }
    if (pingTimeoutId.current) {
      clearTimeout(pingTimeoutId.current);
      pingTimeoutId.current = null;
    }
  };

  useEffect(() => {
    connect(); // Initial connection attempt
    return () => {
      console.log("Cleaning up KuCoinAllTickersSocket: Closing WebSocket and clearing timers.");
      stopPingPong();
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null; // Prevent onclose from trying to reconnect after deliberate close
        if (socketRef.current.readyState < WebSocket.CLOSING) {
            socketRef.current.close(1000, "Component unmounting");
        }
        socketRef.current = null;
      }
      setWebsocketStatus('idle');
    };
  }, [connect]);

  const processedTickers = useMemo(() => Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)), [tickers]);

  return { processedTickers, websocketStatus };
}
