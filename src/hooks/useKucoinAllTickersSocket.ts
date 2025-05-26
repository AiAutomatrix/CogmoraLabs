
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
} from "@/types/websocket";

// Simulated values that would normally come from the /api/v1/bullet-public endpoint
const SIMULATED_API_BASE_URL = "https://api.kucoin.com"; // For REST calls
const SIMULATED_WS_ENDPOINT = "wss://ws-api-spot.kucoin.com/endpoint";
const SIMULATED_TOKEN = "simulated_token_for_public_feed__this_will_be_rejected";
const SIMULATED_PING_INTERVAL = 18000; // Default from KuCoin docs if not in token response
const SIMULATED_PING_TIMEOUT = 10000;  // Default from KuCoin docs
const RECONNECT_DELAY = 5000; // 5 seconds

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<{ [symbol: string]: DisplayTickerData }>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  
  const connectId = useRef<string | null>(null);
  const currentSubscriptionId = useRef<number | null>(null);
  const currentPingInterval = useRef<number>(SIMULATED_PING_INTERVAL);
  const currentPingTimeout = useRef<number>(SIMULATED_PING_TIMEOUT);

  const fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket already open or opening.");
      return;
    }
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    setWebsocketStatus("connecting_token");
    console.log("KuCoin WS: Simulating fetching WebSocket token...");

    // ** IN A REAL APP: Replace this with actual POST to /api/v1/bullet-public **
    // const realTokenResponse = await fetch(`${SIMULATED_API_BASE_URL}/api/v1/bullet-public`, { method: 'POST' });
    // const tokenData: KucoinTokenResponse = await realTokenResponse.json();
    // For simulation:
    await new Promise(resolve => setTimeout(resolve, 300)); 
    const simulatedResponse: KucoinTokenResponse = {
      code: "200000", // Simulate success
      data: {
        token: SIMULATED_TOKEN,
        instanceServers: [
          {
            endpoint: SIMULATED_WS_ENDPOINT,
            protocol: "websocket",
            encrypt: true,
            pingInterval: SIMULATED_PING_INTERVAL, // Use simulated or actual from response
            pingTimeout: SIMULATED_PING_TIMEOUT,   // Use simulated or actual from response
          },
        ],
      },
    };
    // ** END OF SIMULATION **

    if (simulatedResponse.code === "200000" && simulatedResponse.data?.instanceServers?.length > 0) {
      const serverInfo = simulatedResponse.data.instanceServers[0];
      const token = simulatedResponse.data.token;
      currentPingInterval.current = serverInfo.pingInterval || SIMULATED_PING_INTERVAL;
      currentPingTimeout.current = serverInfo.pingTimeout || SIMULATED_PING_TIMEOUT;

      connectId.current = `tradeflow-${Date.now()}`; 
      const wsUrl = `${serverInfo.endpoint}?token=${token}&connectId=${connectId.current}`;
      
      console.log(`KuCoin WS: Attempting to connect to: ${wsUrl.split('?')[0]}... (using simulated token)`);
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
        setWebsocketStatus("open"); // Waiting for 'welcome'
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
          
          switch (message.type) {
            case "welcome":
              const welcomeMsg = message as KucoinWelcomeMessage;
              if (welcomeMsg.id === connectId.current) {
                console.log("KuCoin WS: Welcome received. ID:", welcomeMsg.id);
                setWebsocketStatus("welcomed");
                
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
                  console.log("KuCoin WS: Sent subscription request for /market/ticker:all", {id: subscribeMsg.id});
                  setWebsocketStatus("subscribing");
                  startPingPong();
                }
              } else {
                console.warn("KuCoin WS: Received welcome for unexpected connectId:", welcomeMsg.id, "Expected:", connectId.current);
              }
              break;

            case "ack":
              if (message.id && String(message.id) === String(currentSubscriptionId.current)) {
                console.log("KuCoin WS: Subscription ACK received for /market/ticker:all.");
                setWebsocketStatus("subscribed");
              } else {
                // console.warn("KuCoin WS: Received ACK for unknown or mismatched ID:", message);
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
              if (message.topic === "/market/ticker:all" && message.subject && message.data) {
                const symbol = message.subject;
                const rawData = message.data as KucoinRawTickerData;
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
              if (kucoinError.code === "401" && kucoinError.data === "token is invalid") {
                console.warn(`KuCoin WS: Expected error due to simulated token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              // Consider closing if it's a critical error like invalid token
              if (kucoinError.code === "401") {
                socketRef.current?.close(1000, "Invalid token received from server");
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
        console.error("KuCoin WS: Connection error. Type:", event.type, "Using placeholder URL for simulation.");
        setWebsocketStatus('error');
      };

      socketRef.current.onclose = (event: CloseEvent) => {
        console.warn(`KuCoin WS: Closed. Code: ${event.code}, Reason: "${event.reason || 'No reason'}". Clean: ${event.wasClean}`);
        setWebsocketStatus('disconnected');
        stopPingPong();
        if (!event.wasClean && event.code !== 1000 && event.code !== 1008) { // 1000 normal, 1008 policy violation (e.g. bad token)
          scheduleReconnect();
        }
      };

    } else {
      console.error("KuCoin WS: Failed to simulate token fetch or invalid response structure.", simulatedResponse);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  }, []); 

  const scheduleReconnect = () => {
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
    stopPingPong();
    console.log(`KuCoin WS: Starting ping/pong. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    pingIntervalId.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const pingMsg: KucoinPingMessage = { id: Date.now(), type: "ping" };
        socketRef.current.send(JSON.stringify(pingMsg));
        // console.log("KuCoin WS: Sent Ping:", pingMsg.id);

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn("KuCoin WS: Ping timeout! No pong received. Closing WebSocket.");
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
      stopPingPong();
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
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
    };
  }, [fetchTokenAndConnect]);

  const processedTickers = useMemo(() => 
    Object.values(tickers).sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
