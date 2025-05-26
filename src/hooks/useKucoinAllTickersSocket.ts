
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
// In a real app, this base URL would be used for the REST call to get the token
// const KUCOIN_API_BASE_URL_FOR_TOKEN = "https://api.kucoin.com"; 

// This is a placeholder for the actual token response.
// In a real app, this data would come from a POST request to /api/v1/bullet-public
const SIMULATED_PUBLIC_TOKEN_RESPONSE: KucoinTokenResponse = {
  code: "200000",
  data: {
    token: "SIMULATED_PUBLIC_TOKEN_FROM_BULLET_PUBLIC_CALL_V2_FOR_ALL_TICKERS", // This is what will be sent to the server
    instanceServers: [
      {
        endpoint: "wss://ws-api-spot.kucoin.com/endpoint", // Real KuCoin Spot WebSocket base
        protocol: "websocket",
        encrypt: true,
        pingInterval: 18000, // KuCoin default, actual value from API is preferred
        pingTimeout: 10000,  // KuCoin default, actual value from API is preferred
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
  
  const connectId = useRef<string | null>(null);
  const currentSubscriptionRequestId = useRef<string | null>(null); 

  // Refs to store dynamic server-provided ping settings
  const currentPingInterval = useRef<number>(SIMULATED_PUBLIC_TOKEN_RESPONSE.data.instanceServers[0].pingInterval);
  const currentPingTimeout = useRef<number>(SIMULATED_PUBLIC_TOKEN_RESPONSE.data.instanceServers[0].pingTimeout);

  const parseFloatSafe = (value: string | undefined | null): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const scheduleReconnect = useCallback(() => {
    stopPingPong(); // Clear existing ping timers
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
  }, []); // Added fetchTokenAndConnect to dependency array if it's defined outside or memoized separately

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
  
  const startPingPong = useCallback(() => {
    stopPingPong(); 
    console.log(`KuCoin WS: Starting ping/pong. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`; 
        const pingMsg: KucoinPingMessage = { id: pingId, type: "ping" };
        try {
          socketRef.current.send(JSON.stringify(pingMsg));
          // console.log("KuCoin WS: Ping sent, ID:", pingId);
        } catch (e) {
            console.error("KuCoin WS: Error sending ping:", e);
        }
        
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("KuCoin WS: Ping timeout! No pong received. Closing WebSocket to trigger reconnect.");
          setWebsocketStatus('error'); // Reflect that an error (timeout) occurred
          socketRef.current?.close(1001, "Ping timeout"); 
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, []);


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
    console.log("KuCoin WS: Simulating public WebSocket token fetch from POST /api/v1/bullet-public...");
    
    // --- SIMULATION: Replace this with actual fetch in a real app ---
    // In a real app:
    // try {
    //   const response = await fetch(`${KUCOIN_API_BASE_URL_FOR_TOKEN}/api/v1/bullet-public`, { method: 'POST' });
    //   if (!response.ok) {
    //     const errorText = await response.text();
    //     throw new Error(`Failed to fetch KuCoin token: ${response.status} ${errorText}`);
    //   }
    //   const tokenAPIResponse: KucoinTokenResponse = await response.json();
    //   // Proceed with tokenAPIResponse...
    // } catch (err) {
    //   console.error("KuCoin WS: Error fetching token:", err);
    //   setWebsocketStatus("error");
    //   scheduleReconnect(); // Pass scheduleReconnect if needed
    //   return;
    // }
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    const tokenAPIResponse = SIMULATED_PUBLIC_TOKEN_RESPONSE; // Using simulated response
    // --- END OF SIMULATION ---

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
        // Status will be updated to 'welcomed' upon receiving and matching the welcome message
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
          
          switch (message.type) {
            case "welcome":
              const welcomeMsg = message as KucoinWelcomeMessage;
              if (welcomeMsg.id === connectId.current) {
                console.log("KuCoin WS: Welcome received for connectId:", welcomeMsg.id, "Connection active.");
                setWebsocketStatus("welcomed"); 
                
                currentSubscriptionRequestId.current = `sub-${Date.now()}`;
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
              // console.log("KuCoin WS: Pong received for ping ID:", message.id);
              break;

            case "message":
              if (message.topic === SUBSCRIBE_TOPIC_ALL_TICKERS && message.type === "message") {
                const tickerMsg = message as KucoinTickerMessageAll;
                const symbol = tickerMsg.subject; 
                const rawData = tickerMsg.data as KucoinRawTickerData;

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
                    size: parseFloatSafe(rawData.size), // Last trade size
                    lastUpdate: new Date(rawData.Time ?? Date.now()), 
                    sequence: rawData.sequence,
                  },
                }));
              }
              break;

            case "error":
              const kucoinError = message as KucoinErrorMessage;
              // Check for the specific "token is invalid" error to log as a warning
              if (kucoinError.code === "401" && typeof kucoinError.data === 'string' && kucoinError.data.trim().toLowerCase().includes("token is invalid")) {
                console.warn(`KuCoin WS: Expected error due to simulated token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              if (kucoinError.code === "401") { 
                // For invalid token, close the socket explicitly.
                // The onclose handler will then decide whether to attempt reconnect.
                // For this specific "token is invalid", we might not want to reconnect with the same bad token.
                socketRef.current?.close(1008, "Invalid token: " + kucoinError.data);
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
        console.error("KuCoin WS: WebSocket connection error. Type:", event.type, "Check Network tab for details or server logs.");
        setWebsocketStatus('error');
        // Connection will likely close, onclose will handle reconnect logic
      };

      socketRef.current.onclose = (event: CloseEvent) => {
        console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: "${event.reason || 'No reason provided'}". Clean: ${event.wasClean}`);
        setWebsocketStatus('disconnected');
        stopPingPong();
        
        // Do not attempt to reconnect if the closure was due to an invalid token error we initiated.
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
  }, [scheduleReconnect, startPingPong]); // Added scheduleReconnect and startPingPong

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
