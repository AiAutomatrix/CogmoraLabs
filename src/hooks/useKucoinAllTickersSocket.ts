
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type {
  IncomingKucoinWebSocketMessage,
  DisplayTickerData,
  KucoinSubscribeMessage,
  KucoinPingMessage,
  WebSocketStatus,
  KucoinErrorMessage, // Ensure this is imported if not already
} from "@/types/websocket";

const PLACEHOLDER_WS_URL = "wss://ws-api-spot.kucoin.com/"; // Using the correct Spot URL as a base
const SIMULATED_PING_INTERVAL = 18000; // As per KuCoin docs example
const SIMULATED_PING_TIMEOUT = 10000; // As per KuCoin docs example
const RECONNECT_DELAY = 5000; // 5 seconds

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
    // In a real application, you would POST to /api/v1/bullet-public to get a token and endpoint.
    // For example:
    // setWebsocketStatus('connecting_token');
    // fetch('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST' }) // Or Futures URL if needed
    //   .then(res => res.json())
    //   .then(data => {
    //     if (data.code === '200000' && data.data.token && data.data.instanceServers.length > 0) {
    //       const { token, instanceServers } = data.data;
    //       const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${Date.now()}`;
    //       // Proceed to new WebSocket(wsUrl);
    //       // Set pingInterval based on instanceServers[0].pingInterval
    //       // Set pingTimeout based on instanceServers[0].pingTimeout
    //     } else {
    //       setWebsocketStatus('error');
    //       scheduleReconnect();
    //     }
    //   })
    //   .catch(() => {
    //     setWebsocketStatus('error');
    //     scheduleReconnect();
    //   });
    // For this placeholder:
    const wsUrl = PLACEHOLDER_WS_URL; // This will likely fail to connect meaningfully without a token
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
      console.log("WebSocket connection opened. Waiting for welcome message...");
      setWebsocketStatus('connected_ws');
      // KuCoin server sends a 'welcome' message first. Subscription happens after that.
    };

    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
        // console.log("WS Message Received:", message.type, message);

        switch (message.type) {
          case "welcome":
            console.log("KuCoin WebSocket Welcome received. ID:", message.id);
            setWebsocketStatus('welcomed');
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              currentSubscriptionId.current = Date.now();
              const subscribeMsg: KucoinSubscribeMessage = {
                id: currentSubscriptionId.current,
                type: "subscribe",
                topic: "/market/ticker:all", // Subscribe to all tickers
                privateChannel: false, // Public topic
                response: true, // Request an acknowledgment
              };
              socketRef.current.send(JSON.stringify(subscribeMsg));
              console.log("Sent subscription request for /market/ticker:all", subscribeMsg);
              setWebsocketStatus('subscribing');
              startPingPong(); // Start ping/pong after successful welcome and subscription intent
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
            // console.log("Pong received:", message.id);
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
            // Type assertion for more specific error handling
            const kucoinError = message as KucoinErrorMessage;
            console.error(`KuCoin WebSocket Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
            setWebsocketStatus('error');
            // Depending on the error, you might want to close and reconnect.
            // For example, if it's an auth error for a private channel.
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
      console.error("WebSocket error event:", event.type, "Check network tab or WebSocket connection details for more info.");
      setWebsocketStatus('error');
      // Connection will likely close, onclose will handle reconnect
    };

    socketRef.current.onclose = (event: CloseEvent) => {
      console.warn(`WebSocket closed. Code: ${event.code}, Reason: "${event.reason || 'No reason'}". WasClean: ${event.wasClean}`);
      setWebsocketStatus('disconnected');
      stopPingPong();
      // Don't attempt to reconnect if it was a normal closure (code 1000) or if explicitly told not to
      if (!event.wasClean && event.code !== 1000 /* 1000 is normal closure */) {
        scheduleReconnect();
      }
    };
  }, []); // connect is stable due to useCallback

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
    stopPingPong(); // Clear any existing ping/pong timers
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now(), type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));
        // console.log("Sent Ping:", pingMsg.id);

        // Set a timeout for the pong
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("Ping timeout! No pong received. Closing WebSocket.");
          socketRef.current?.close(1001, "Ping timeout"); // 1001 indicates going away
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
        // Important: nullify handlers before closing to prevent them from running on deliberate close
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (socketRef.current.readyState < WebSocket.CLOSING) {
            socketRef.current.close(1000, "Component unmounting"); // Normal closure
        }
        socketRef.current = null;
      }
      setWebsocketStatus('idle'); // Reset status on unmount
    };
  }, [connect]);

  // Memoize processedTickers to prevent unnecessary re-renders of the consuming component
  // if the tickers object reference changes but its content effectively hasn't for sorting.
  const processedTickers = useMemo(() => Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)), [tickers]);

  return { processedTickers, websocketStatus };
}
