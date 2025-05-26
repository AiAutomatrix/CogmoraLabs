
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type {
  IncomingKucoinWebSocketMessage,
  DisplayTickerData,
  KucoinSubscribeMessage,
  KucoinPingMessage,
  WebSocketStatus,
  KucoinTokenResponse,
  KucoinErrorMessage,
  KucoinWelcomeMessage,
  KucoinRawTickerData,
  KucoinTickerMessageAll,
} from "@/types/websocket";

// --- KuCoin API Constants & Simulation ---
const SIMULATED_KUCOIN_API_BASE_URL_FOR_TOKEN = "https://api.kucoin.com"; // For conceptual REST call
const SIMULATED_WS_ENDPOINT_BASE = "wss://ws-api-spot.kucoin.com"; // Base, actual endpoint has /endpoint from token response
const SIMULATED_PUBLIC_TOKEN_RESPONSE: KucoinTokenResponse = {
  code: "200000",
  data: {
    token: "simulated_public_token_from_bullet_public_call_v2_for_all_tickers",
    instanceServers: [
      {
        endpoint: `${SIMULATED_WS_ENDPOINT_BASE}/endpoint`, // Example endpoint
        protocol: "websocket",
        encrypt: true,
        pingInterval: 18000, // KuCoin default, can be overridden by server
        pingTimeout: 10000,  // KuCoin default
      },
    ],
  },
};

const RECONNECT_DELAY = 5000; // 5 seconds
const SUBSCRIBE_TOPIC_ALL_TICKERS = "/market/ticker:all";

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<{ [symbol: string]: DisplayTickerData }>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  
  const connectId = useRef<string | null>(null); // For matching welcome message
  const currentSubscriptionRequestId = useRef<string | null>(null); // For matching ack to subscribe

  const currentPingInterval = useRef<number>(SIMULATED_PUBLIC_TOKEN_RESPONSE.data.instanceServers[0].pingInterval);
  const currentPingTimeout = useRef<number>(SIMULATED_PUBLIC_TOKEN_RESPONSE.data.instanceServers[0].pingTimeout);

  const parseFloatSafe = (value: string | undefined | null): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket already open or opening.");
      return;
    }
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    setWebsocketStatus("fetching_token");
    console.log(`KuCoin WS: Simulating token fetch from POST ${SIMULATED_KUCOIN_API_BASE_URL_FOR_TOKEN}/api/v1/bullet-public...`);

    // ** SIMULATION: Replace this with actual fetch in a real app **
    // In a real app:
    // try {
    //   const response = await fetch(`${SIMULATED_KUCOIN_API_BASE_URL_FOR_TOKEN}/api/v1/bullet-public`, { method: 'POST' });
    //   if (!response.ok) {
    //     throw new Error(`Failed to fetch KuCoin token: ${response.status} ${await response.text()}`);
    //   }
    //   const tokenAPIResponse: KucoinTokenResponse = await response.json();
    //   // Proceed with tokenAPIResponse...
    // } catch (err) {
    //   console.error("KuCoin WS: Error fetching token:", err);
    //   setWebsocketStatus("error");
    //   scheduleReconnect();
    //   return;
    // }
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    const tokenAPIResponse = SIMULATED_PUBLIC_TOKEN_RESPONSE;
    // ** END OF SIMULATION **

    if (tokenAPIResponse.code === "200000" && tokenAPIResponse.data?.instanceServers?.length > 0) {
      const serverInfo = tokenAPIResponse.data.instanceServers[0];
      const token = tokenAPIResponse.data.token;
      
      currentPingInterval.current = serverInfo.pingInterval;
      currentPingTimeout.current = serverInfo.pingTimeout;

      connectId.current = `tradeflow-${Date.now()}`;
      const wsUrl = `${serverInfo.endpoint}?token=${token}&connectId=${connectId.current}`;
      
      console.log(`KuCoin WS: Attempting to connect to: ${serverInfo.endpoint} (using connectId: ${connectId.current})`);
      setWebsocketStatus("connecting_ws");

      try {
        socketRef.current = new WebSocket(wsUrl);
      } catch (e) {
        console.error("KuCoin WS: WebSocket instantiation error:", e);
        setWebsocketStatus('error');
        scheduleReconnect();
        return;
      }

      socketRef.current.onopen = () => {
        console.log("KuCoin WS: Connection opened. Waiting for welcome message...");
        // Status remains 'connecting_ws' or similar until 'welcome' is received and matched
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
          
          switch (message.type) {
            case "welcome":
              const welcomeMsg = message as KucoinWelcomeMessage;
              if (welcomeMsg.id === connectId.current) {
                console.log("KuCoin WS: Welcome received for connectId:", welcomeMsg.id, "Connection active.");
                setWebsocketStatus("welcomed"); // Or "connected" if you prefer
                
                currentSubscriptionRequestId.current = `sub-${Date.now()}`; // New unique ID for the subscribe request
                const subscribeMsg: KucoinSubscribeMessage = {
                  id: currentSubscriptionRequestId.current, 
                  type: "subscribe",
                  topic: SUBSCRIBE_TOPIC_ALL_TICKERS,
                  privateChannel: false, 
                  response: true,
                };

                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify(subscribeMsg));
                    console.log(`KuCoin WS: Sent subscription request for ${SUBSCRIBE_TOPIC_ALL_TICKERS}, ID: ${subscribeMsg.id}`);
                    setWebsocketStatus("subscribing");
                    startPingPong(); 
                } else {
                    console.warn("KuCoin WS: Welcome received, but socket not open to subscribe.");
                }
              } else {
                console.warn("KuCoin WS: Received welcome for unexpected connectId:", welcomeMsg.id, "Expected:", connectId.current);
              }
              break;

            case "ack":
              if (message.id && message.id === currentSubscriptionRequestId.current) {
                console.log(`KuCoin WS: Subscription ACK received for ID: ${message.id}`);
                setWebsocketStatus("subscribed");
              } else {
                console.log("KuCoin WS: Received ACK for ID:", message.id, "(Not matching current subscription request ID:", currentSubscriptionRequestId.current, ")");
              }
              break;

            case "pong":
              if (pingTimeoutId.current) {
                clearTimeout(pingTimeoutId.current);
                pingTimeoutId.current = null;
              }
              // console.log("KuCoin WS: Pong received for ping ID:", message.id); // Can be verbose
              break;

            case "message":
              if (message.topic === SUBSCRIBE_TOPIC_ALL_TICKERS && message.type === "message") {
                const tickerMsg = message as KucoinTickerMessageAll;
                const symbol = tickerMsg.subject; 
                const rawData = tickerMsg.data as KucoinRawTickerData; // Type assertion for clarity

                setTickers((prevTickers) => ({
                  ...prevTickers,
                  [symbol]: {
                    symbol: symbol,
                    lastPrice: parseFloatSafe(rawData.last ?? rawData.price),
                    bestBid: parseFloatSafe(rawData.buy ?? rawData.bestBid),
                    bestAsk: parseFloatSafe(rawData.sell ?? rawData.bestAsk),
                    changeRate24h: parseFloatSafe(rawData.changeRate),
                    changePrice24h: parseFloatSafe(rawData.changePrice),
                    high24h: parseFloatSafe(rawData.high),
                    low24h: parseFloatSafe(rawData.low),
                    volume24h: parseFloatSafe(rawData.vol),
                    bestBidSize: parseFloatSafe(rawData.bestBidSize),
                    bestAskSize: parseFloatSafe(rawData.bestAskSize),
                    size: parseFloatSafe(rawData.size),
                    lastUpdate: new Date(rawData.Time ?? Date.now()), // Use rawData.Time
                    sequence: rawData.sequence,
                  },
                }));
              }
              break;

            case "error":
              const kucoinError = message as KucoinErrorMessage;
               if (kucoinError.code === "401" && typeof kucoinError.data === 'string' && kucoinError.data.trim().toLowerCase() === "token is invalid") {
                console.warn(`KuCoin WS: Expected error due to simulated token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              if (kucoinError.code === "401") { 
                socketRef.current?.close(1008, "Invalid token: " + kucoinError.data); // Code 1008: Policy Violation
              }
              break;

            default:
              // console.warn("KuCoin WS: Unhandled message type:", message.type, message);
              break;
          }
        } catch (err) {
          console.error("KuCoin WS: Invalid WebSocket message or parsing error:", event.data, err);
        }
      };

      socketRef.current.onerror = (event: Event) => {
        console.error("KuCoin WS: WebSocket connection error. Type:", event.type, "Check Network tab in browser devtools or server logs for details.");
        setWebsocketStatus('error');
        // Connection will likely close, onclose will handle reconnect logic
      };

      socketRef.current.onclose = (event: CloseEvent) => {
        console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: "${event.reason || 'No reason provided'}". Clean: ${event.wasClean}`);
        setWebsocketStatus('disconnected');
        stopPingPong();
        
        if (event.code === 1008 && event.reason.includes("Invalid token")) {
            console.log("KuCoin WS: Not attempting reconnect due to invalid token error from server.");
        } else if (event.code !== 1000) { // 1000 is normal closure (e.g., by client)
          scheduleReconnect();
        }
      };

    } else {
      console.error("KuCoin WS: Failed to fetch or parse token from API (simulated or real).", tokenAPIResponse);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  }, []); 

  const scheduleReconnect = useCallback(() => {
    stopPingPong();
    if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (socketRef.current.readyState < WebSocket.CLOSING) {
             socketRef.current.close(1000, "Client preparing to reconnect");
        }
        socketRef.current = null;
    }
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }
    console.log(`KuCoin WS: Scheduling reconnect in ${RECONNECT_DELAY / 1000}s...`);
    reconnectTimeoutId.current = setTimeout(() => {
      console.log("KuCoin WS: Attempting reconnect...");
      fetchTokenAndConnect();
    }, RECONNECT_DELAY);
  }, [fetchTokenAndConnect]);

  const startPingPong = useCallback(() => {
    stopPingPong(); 
    console.log(`KuCoin WS: Starting ping/pong. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`; 
        const pingMsg: KucoinPingMessage = { id: pingId, type: "ping" };
        try {
          socketRef.current.send(JSON.stringify(pingMsg));
        } catch (e) {
            console.error("KuCoin WS: Error sending ping:", e);
            // If send fails, connection is likely broken, onclose will handle.
        }
        
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("KuCoin WS: Ping timeout! No pong received. Closing WebSocket to trigger reconnect.");
          socketRef.current?.close(1001, "Ping timeout"); 
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, []); // Dependencies: currentPingInterval.current and currentPingTimeout.current are refs updated by fetchToken

  const stopPingPong = () => {
    if (pingIntervalId.current) {
      clearInterval(pingIntervalId.current);
      pingIntervalId.current = null;
    }
    if (pingTimeoutId.current) {
      clearTimeout(pingTimeoutId.current);
      pingTimeoutId.current = null;
    }
    // console.log("KuCoin WS: Ping/pong stopped.");
  };

  useEffect(() => {
    fetchTokenAndConnect(); // Initial connection attempt
    return () => {
      console.log("KuCoin WS: Cleaning up hook - Closing WebSocket and clearing timers.");
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
      stopPingPong(); 
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null; 
        if (socketRef.current.readyState < WebSocket.CLOSING) {
          socketRef.current.close(1000, "Component unmounting"); 
        }
        socketRef.current = null;
      }
      setWebsocketStatus('idle'); 
      setTickers({}); 
    };
  }, [fetchTokenAndConnect]); 

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => (a.symbol && b.symbol) ? a.symbol.localeCompare(b.symbol) : 0), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
