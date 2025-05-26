
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
// const KUCOIN_API_BASE_URL = "https://api.kucoin.com"; // For actual REST calls

// Simulated values based on user's documentation
const SIMULATED_WS_ENDPOINT = "wss://ws-api.kucoin.com/endpoint"; // Corrected base endpoint
const SIMULATED_TOKEN = "simulated_public_token_from_bullet_public_call"; // More descriptive
const SIMULATED_PING_INTERVAL = 50000; // From user's sample response
const SIMULATED_PING_TIMEOUT = 10000;  // From user's sample response

const RECONNECT_DELAY = 5000; // 5 seconds
const SUBSCRIBE_TOPIC = "/market/ticker:all";

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<{ [symbol: string]: DisplayTickerData }>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  
  const connectId = useRef<string | null>(null);
  const currentSubscriptionRequestId = useRef<string | null>(null); // To track the ID of the subscribe request

  // Store these from the (simulated) token response
  const currentPingInterval = useRef<number>(SIMULATED_PING_INTERVAL);
  const currentPingTimeout = useRef<number>(SIMULATED_PING_TIMEOUT);

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
    console.log("KuCoin WS: Simulating fetching WebSocket token via POST /api/v1/bullet-public...");

    // ** IN A REAL APP: Replace this with actual POST to /api/v1/bullet-public **
    // const realTokenResponse = await fetch(`${KUCOIN_API_BASE_URL}/api/v1/bullet-public`, { method: 'POST' });
    // if (!realTokenResponse.ok) { /* handle error */ }
    // const tokenData: KucoinTokenResponse = await realTokenResponse.json();
    // For simulation:
    await new Promise(resolve => setTimeout(resolve, 300)); 
    const simulatedTokenAPIResponse: KucoinTokenResponse = {
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

    if (simulatedTokenAPIResponse.code === "200000" && simulatedTokenAPIResponse.data?.instanceServers?.length > 0) {
      const serverInfo = simulatedTokenAPIResponse.data.instanceServers[0];
      const token = simulatedTokenAPIResponse.data.token;
      currentPingInterval.current = serverInfo.pingInterval;
      currentPingTimeout.current = serverInfo.pingTimeout;

      connectId.current = `tradeflow-${Date.now()}`; 
      const wsUrl = `${serverInfo.endpoint}?token=${token}&connectId=${connectId.current}`;
      
      console.log(`KuCoin WS: Attempting to connect to: ${serverInfo.endpoint} (using simulated token & connectId: ${connectId.current})`);
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
        // Status will change to 'welcomed' upon receiving the welcome message
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
          
          switch (message.type) {
            case "welcome":
              const welcomeMsg = message as KucoinWelcomeMessage;
              if (welcomeMsg.id === connectId.current) {
                console.log("KuCoin WS: Welcome received. ID:", welcomeMsg.id, "Connection fully active.");
                setWebsocketStatus("welcomed");
                
                // Subscribe to /market/ticker:all
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  // As per user docs, use connectId for initial subscribe.
                  // However, typically subscription IDs are unique per request.
                  // For now, following user's doc interpretation.
                  currentSubscriptionRequestId.current = connectId.current; // Or Date.now().toString();
                  const subscribeMsg: KucoinSubscribeMessage = {
                    id: currentSubscriptionRequestId.current!, 
                    type: "subscribe",
                    topic: SUBSCRIBE_TOPIC,
                    privateChannel: false,
                    response: true,
                  };
                  socketRef.current.send(JSON.stringify(subscribeMsg));
                  console.log(`KuCoin WS: Sent subscription request for ${SUBSCRIBE_TOPIC}, ID: ${subscribeMsg.id}`);
                  setWebsocketStatus("subscribing");
                  startPingPong(); // Start ping/pong after welcome and subscription attempt
                }
              } else {
                console.warn("KuCoin WS: Received welcome for unexpected connectId:", welcomeMsg.id, "Expected:", connectId.current);
              }
              break;

            case "ack":
              // Check if this ack matches our subscription request ID
              if (message.id && message.id === currentSubscriptionRequestId.current) {
                console.log(`KuCoin WS: Subscription ACK received for topic ${SUBSCRIBE_TOPIC}. ID: ${message.id}`);
                setWebsocketStatus("subscribed");
              } else {
                console.log("KuCoin WS: Received ACK for ID:", message.id);
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
              if (message.topic === SUBSCRIBE_TOPIC && message.type === "message") {
                const tickerMsg = message as KucoinTickerMessageAll;
                const symbol = tickerMsg.subject; // Symbol comes from 'subject' for /market/ticker:all
                const rawData = tickerMsg.data;

                setTickers((prevTickers) => ({
                  ...prevTickers,
                  [symbol]: {
                    symbol: symbol,
                    lastPrice: parseFloatSafe(rawData.last ?? rawData.price),
                    buyPrice: parseFloatSafe(rawData.buy ?? rawData.bestBid),
                    sellPrice: parseFloatSafe(rawData.sell ?? rawData.bestAsk),
                    changeRate24h: parseFloatSafe(rawData.changeRate), // This is usually a rate like 0.01 for 1%
                    changePrice24h: parseFloatSafe(rawData.changePrice),
                    high24h: parseFloatSafe(rawData.high),
                    low24h: parseFloatSafe(rawData.low),
                    volume24h: parseFloatSafe(rawData.vol),
                    lastUpdate: new Date(rawData.Time ?? rawData.time ?? Date.now()), // Use Time or time, fallback to now
                  },
                }));
              }
              break;

            case "error":
              const kucoinError = message as KucoinErrorMessage;
              if (kucoinError.code === "401" && kucoinError.data === "token is invalid") {
                console.warn(`KuCoin WS: Expected error due to simulated token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              if (kucoinError.code === "401") { // If token is invalid, no point in reconnecting with same token
                socketRef.current?.close(1000, "Invalid token: " + kucoinError.data);
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
        console.error("KuCoin WS: WebSocket connection error. Type:", event.type, "Using placeholder URL for simulation. Event details:", event);
        setWebsocketStatus('error');
        // onclose will handle reconnection attempts
      };

      socketRef.current.onclose = (event: CloseEvent) => {
        console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: "${event.reason || 'No reason'}". Clean: ${event.wasClean}`);
        setWebsocketStatus('disconnected');
        stopPingPong();
        if (!event.wasClean && event.code !== 1000 && event.code !== 1008) { // 1000: normal, 1008: policy violation (e.g. bad token)
          scheduleReconnect();
        } else if (event.code === 1008 && event.reason.includes("Invalid token")) {
            console.log("KuCoin WS: Not attempting reconnect due to invalid token error from server.");
        }
      };

    } else {
      console.error("KuCoin WS: Failed to simulate token fetch or invalid response structure.", simulatedTokenAPIResponse);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  }, []); 

  const scheduleReconnect = () => {
    stopPingPong(); // Ensure no pings are sent while disconnected
    if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (socketRef.current.readyState < WebSocket.CLOSING) {
             socketRef.current.close(1000, "Preparing to reconnect");
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
  };

  const startPingPong = () => {
    stopPingPong(); // Clear any existing intervals/timeouts
    console.log(`KuCoin WS: Starting ping/pong. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now().toString(), type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));
        // console.log("KuCoin WS: Sent Ping, ID:", pingMsg.id);

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("KuCoin WS: Ping timeout! No pong received. Closing WebSocket to trigger reconnect.");
          socketRef.current?.close(1001, "Ping timeout"); 
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
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
    // console.log("KuCoin WS: Ping/pong stopped.");
  };

  useEffect(() => {
    fetchTokenAndConnect(); 
    return () => {
      console.log("KuCoin WS: Cleaning up - Closing WebSocket and clearing timers.");
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
      stopPingPong(); // This will clear pingIntervalId and pingTimeoutId
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
      setTickers({}); // Clear tickers on unmount
    };
  }, [fetchTokenAndConnect]); // fetchTokenAndConnect is stable due to useCallback

  const processedTickers = useMemo(() => 
    Object.values(tickers)
          .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
