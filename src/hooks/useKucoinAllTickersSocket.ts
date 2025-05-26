
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type {
  IncomingKucoinWebSocketMessage,
  DisplayTickerData,
  KucoinSubscribeMessage,
  KucoinPingMessage,
  WebSocketStatus,
  KucoinTokenResponse, // For simulated token response
  KucoinErrorMessage,
} from "@/types/websocket";

// Simulated values that would normally come from the /api/v1/bullet-public endpoint
const SIMULATED_WS_ENDPOINT = "wss://ws-api-spot.kucoin.com/endpoint"; // Example, might need adjustment
const SIMULATED_TOKEN = "simulated_token_for_public_feed";
const SIMULATED_PING_INTERVAL = 18000; // From KuCoin docs
const SIMULATED_PING_TIMEOUT = 10000;  // From KuCoin docs
const RECONNECT_DELAY = 5000; // 5 seconds

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<{ [symbol: string]: DisplayTickerData }>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  
  const connectId = useRef<string | null>(null);
  const currentSubscriptionId = useRef<number | null>(null); // For tracking specific subscription requests

  // Simulate fetching a token and then connecting
  const fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("WebSocket already open or opening.");
      return;
    }
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    setWebsocketStatus("connecting_token");
    console.log("Simulating fetching KuCoin WebSocket token...");

    // ** IN A REAL APP: Replace this with actual POST to /api/v1/bullet-public **
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call delay
    const simulatedResponse: KucoinTokenResponse = {
      code: "200000",
      data: {
        token: SIMULATED_TOKEN,
        instanceServers: [
          {
            endpoint: SIMULATED_WS_ENDPOINT,
            protocol: "websocket",
            encrypt: true,
            pingInterval: SIMULATED_PING_INTERVAL,
            pingTimeout: SIMULATED_PING_TIMEOUT,
          },
        ],
      },
    };
    // ** END OF SIMULATION **

    if (simulatedResponse.code === "200000" && simulatedResponse.data.instanceServers.length > 0) {
      const serverInfo = simulatedResponse.data.instanceServers[0];
      connectId.current = `tradeflow-${Date.now()}`; // Generate a unique connectId
      const wsUrl = `${serverInfo.endpoint}?token=${simulatedResponse.data.token}&connectId=${connectId.current}`;
      
      console.log(`Attempting to connect to KuCoin WebSocket: ${wsUrl.split('?')[0]}...`);
      setWebsocketStatus("connecting_ws");

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
        // Server sends "welcome" first, subscription happens after that.
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
          // console.log("WS Message Received:", message.type, message);

          switch (message.type) {
            case "welcome":
              if (message.id === connectId.current) {
                console.log("KuCoin WebSocket Welcome received. ID:", message.id);
                setWebsocketStatus("welcomed");
                // Subscribe to /market/ticker:all
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  currentSubscriptionId.current = Date.now();
                  const subscribeMsg: KucoinSubscribeMessage = {
                    id: currentSubscriptionId.current,
                    type: "subscribe",
                    topic: "/market/ticker:all",
                    privateChannel: false,
                    response: true,
                  };
                  socketRef.current.send(JSON.stringify(subscribeMsg));
                  console.log("Sent subscription request for /market/ticker:all", subscribeMsg);
                  setWebsocketStatus("subscribing");
                  startPingPong(serverInfo.pingInterval, serverInfo.pingTimeout);
                }
              } else {
                console.warn("Received welcome for unexpected connectId:", message.id, "Expected:", connectId.current);
              }
              break;

            case "ack":
              if (message.id && String(message.id) === String(currentSubscriptionId.current)) {
                console.log("Subscription ACK received for /market/ticker:all");
                setWebsocketStatus("subscribed");
              } else {
                console.warn("Received ACK for unknown or mismatched ID:", message);
              }
              break;

            case "pong":
              // console.log("Pong received, clearing ping timeout. ID:", message.id);
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
              const kucoinError = message as KucoinErrorMessage;
              console.error(`KuCoin WebSocket Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              setWebsocketStatus('error');
              // Optionally close and reconnect depending on the error
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
        if (!event.wasClean && event.code !== 1000) { // 1000 is normal closure
          scheduleReconnect();
        }
      };

    } else {
      console.error("Failed to simulate token fetch or invalid response structure.", simulatedResponse);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  }, []); // Stable, does not depend on component state

  const scheduleReconnect = () => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }
    console.log(`Scheduling reconnect in ${RECONNECT_DELAY / 1000}s...`);
    reconnectTimeoutId.current = setTimeout(() => {
      fetchTokenAndConnect();
    }, RECONNECT_DELAY);
  };

  const startPingPong = (interval: number, timeout: number) => {
    stopPingPong();
    console.log(`Starting ping/pong with interval ${interval}ms, timeout ${timeout}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now(), type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));
        // console.log("Sent Ping:", pingMsg.id);

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("Ping timeout! No pong received. Closing WebSocket.");
          socketRef.current?.close(1001, "Ping timeout"); // 1001 indicates going away
        }, timeout);
      }
    }, interval);
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
    // console.log("Ping/pong stopped.");
  };

  useEffect(() => {
    fetchTokenAndConnect(); // Initial connection attempt
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
        socketRef.current.onclose = null; // Important to prevent scheduleReconnect on deliberate close
        if (socketRef.current.readyState < WebSocket.CLOSING) {
          socketRef.current.close(1000, "Component unmounting");
        }
        socketRef.current = null;
      }
      setWebsocketStatus('idle');
    };
  }, [fetchTokenAndConnect]);

  const processedTickers = useMemo(() => 
    Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
