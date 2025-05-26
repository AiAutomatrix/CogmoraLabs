
import { useEffect, useRef, useState, useCallback, useMemo } from "react"; // Added useMemo
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
const SIMULATED_TOKEN = "simulated_public_token_from_bullet_public_call_v2";
const SIMULATED_PING_INTERVAL = 18000; // Default from KuCoin docs
const SIMULATED_PING_TIMEOUT = 10000; // Default from KuCoin docs

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
    console.log(`KuCoin WS: Simulating token fetch from POST ${SIMULATED_KUCOIN_API_BASE_URL_FOR_TOKEN}/api/v1/bullet-public...`);

    // ** SIMULATION: Replace this with actual fetch in a real app **
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
    const simulatedTokenAPIResponse: KucoinTokenResponse = {
      code: "200000",
      data: {
        token: SIMULATED_TOKEN,
        instanceServers: [
          {
            endpoint: `${SIMULATED_WS_ENDPOINT_BASE}/endpoint`,
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
      
      // Store actual ping intervals from (simulated) server response
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
        // Status remains 'connecting_ws' or similar until 'welcome' is received
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
                
                // Per docs, subscription ID should match connectId for the initial topic.
                // For subsequent subscriptions on same connection, use new unique IDs.
                currentSubscriptionRequestId.current = connectId.current; 
                const subscribeMsg: KucoinSubscribeMessage = {
                  id: currentSubscriptionRequestId.current!, 
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
              if (message.id && message.id === currentSubscriptionRequestId.current) { // Match against the ID used in subscribeMsg
                console.log(`KuCoin WS: Subscription ACK received for topic. ID: ${message.id}`);
                setWebsocketStatus("subscribed");
              } else {
                console.log("KuCoin WS: Received ACK for ID:", message.id, "(Not matching current subscription request ID)");
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
                const rawData = tickerMsg.data;

                setTickers((prevTickers) => ({
                  ...prevTickers,
                  [symbol]: {
                    symbol: symbol,
                    lastPrice: parseFloatSafe(rawData.last ?? rawData.price), // Use 'last' or 'price'
                    bestBid: parseFloatSafe(rawData.buy ?? rawData.bestBid),     // Use 'buy' or 'bestBid'
                    bestAsk: parseFloatSafe(rawData.sell ?? rawData.bestAsk),    // Use 'sell' or 'bestAsk'
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
               if (kucoinError.code === "401" && typeof kucoinError.data === 'string' && kucoinError.data.trim().toLowerCase() === "token is invalid") {
                console.warn(`KuCoin WS: Expected error due to simulated token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              if (kucoinError.code === "401") { 
                // If token is invalid, close the connection with a reason to prevent immediate reconnect with the same bad token.
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
        console.error("KuCoin WS: WebSocket connection error. Type:", event.type, "Check Network tab for details.");
        setWebsocketStatus('error');
        // Connection will likely close, onclose will handle reconnect logic
      };

      socketRef.current.onclose = (event: CloseEvent) => {
        console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: "${event.reason || 'No reason provided'}". Clean: ${event.wasClean}`);
        setWebsocketStatus('disconnected');
        stopPingPong();
        // Only attempt to reconnect if the closure was not clean (e.g., network error)
        // or if it was clean but not due to a specific client action or a "token invalid" error.
        // Code 1000 is a normal closure. Code 1008 (Policy Violation) is used for "token is invalid".
        if (!event.wasClean && event.code !== 1000 && event.code !== 1008) { 
          scheduleReconnect();
        } else if (event.code === 1008 && event.reason.includes("Invalid token")) {
            console.log("KuCoin WS: Not attempting reconnect due to invalid token error from server.");
        }
      };

    } else {
      console.error("KuCoin WS: Failed to simulate token fetch or invalid response structure.", simulatedTokenAPIResponse);
      setWebsocketStatus("error");
      scheduleReconnect(); // Attempt reconnect even if token fetch fails
    }
  }, []); // Empty dependency array: connect only on mount or manual call

  const scheduleReconnect = () => {
    stopPingPong(); // Ensure no old pings are running
    if (socketRef.current) { // Defensive cleanup of old socket listeners
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
        const pingId = Date.now().toString(); // Ping ID must be a string
        const pingMsg: KucoinPingMessage = { id: pingId, type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));
        // console.log("KuCoin WS: Sent Ping, ID:", pingMsg.id);

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("KuCoin WS: Ping timeout! No pong received. Closing WebSocket to trigger reconnect.");
          // Close with a specific code if needed, or just close to trigger onclose handler
          socketRef.current?.close(1001, "Ping timeout"); // 1001 = Going Away
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
  };

  useEffect(() => {
    fetchTokenAndConnect(); // Initial connection attempt
    return () => {
      console.log("KuCoin WS: Cleaning up hook - Closing WebSocket and clearing timers.");
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
      stopPingPong(); // Stop ping/pong process
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null; // Important to remove listener before closing
        if (socketRef.current.readyState < WebSocket.CLOSING) {
          socketRef.current.close(1000, "Component unmounting"); // Normal closure
        }
        socketRef.current = null;
      }
      setWebsocketStatus('idle'); // Reset status on unmount
      setTickers({}); // Clear tickers on unmount
    };
  }, [fetchTokenAndConnect]); 

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
