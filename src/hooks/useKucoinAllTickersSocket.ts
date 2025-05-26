
import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  KucoinTokenResponse,
  IncomingKucoinWebSocketMessage,
  KucoinTickerMessageAll,
  KucoinErrorMessage,
  KucoinWelcomeMessage,
  KucoinAckMessage,
  KucoinPongMessage,
  DisplayTickerData,
  WebSocketStatus,
  KucoinRawTickerData,
} from '@/types/websocket';

const RECONNECT_DELAY_MS = 5000; // 5 seconds
const SIMULATED_PING_INTERVAL = 18000; // Default from KuCoin docs if not provided
const SIMULATED_PING_TIMEOUT = 10000;  // Default from KuCoin docs if not provided

function parseFloatSafe(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

export function useKucoinAllTickersSocket() {
  const [tickers, setTickers] = useState<Record<string, DisplayTickerData>>({});
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalId = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const connectId = useRef<string | null>(null);
  const currentSubscriptionRequestId = useRef<string | null>(null);
  const isClosing = useRef<boolean>(false); // To prevent reconnect on intentional close (unmount)

  const currentPingInterval = useRef<number>(SIMULATED_PING_INTERVAL);
  const currentPingTimeout = useRef<number>(SIMULATED_PING_TIMEOUT);


  const stopPingPong = useCallback(() => {
    if (pingIntervalId.current) {
      clearInterval(pingIntervalId.current);
      pingIntervalId.current = null;
      console.log("KuCoin WS: Ping interval cleared.");
    }
    if (pingTimeoutId.current) {
      clearTimeout(pingTimeoutId.current);
      pingTimeoutId.current = null;
      console.log("KuCoin WS: Ping timeout cleared.");
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    console.log(`KuCoin WS: Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
    stopPingPong(); // Stop any existing ping mechanism
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        console.log("KuCoin WS: Closing existing socket before reconnect attempt.");
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
    }
    setTimeout(() => {
      if (!isClosing.current) { // Check if component is still mounted / hook is active
        console.log("KuCoin WS: Attempting to reconnect...");
        fetchTokenAndConnect();
      } else {
        console.log("KuCoin WS: Reconnect aborted as component is unmounting.");
      }
    }, RECONNECT_DELAY_MS);
  }, [stopPingPong]); // Added fetchTokenAndConnect to deps, but it's defined below, let's see

  const startPingPong = useCallback(() => {
    console.log(`KuCoin WS: Starting ping mechanism. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    stopPingPong(); // Clear any existing timers

    pingIntervalId.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`;
        console.log(`KuCoin WS: Sending ping with ID: ${pingId}`);
        socketRef.current.send(JSON.stringify({ id: pingId, type: "ping" }));

        // Set a timeout to wait for the pong
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current); // Clear previous pong timeout
        pingTimeoutId.current = setTimeout(() => {
          console.warn(`KuCoin WS: Ping timeout! No pong received for ID (or last ping). Closing socket.`);
          socketRef.current?.close(); // This will trigger onclose and then scheduleReconnect
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, [stopPingPong]);


  const fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket connection attempt already in progress or open.");
      return;
    }
    isClosing.current = false; // Reset before new connection attempt
    setWebsocketStatus("fetching_token");
    console.log("KuCoin WS: Attempting to fetch public WebSocket token...");

    try {
      const response = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
        method: "POST",
      });
      
      console.log("KuCoin WS: Token API response status:", response.status);
      const responseText = await response.text(); // Get text first for logging
      console.log("KuCoin WS: Token API raw response text:", responseText);

      if (!response.ok) {
        throw new Error(`Failed to fetch KuCoin token: ${response.status} - ${responseText}`);
      }

      const tokenAPIResponse: KucoinTokenResponse = JSON.parse(responseText);
      console.log("KuCoin WS: Parsed token API response:", tokenAPIResponse);

      if (
        tokenAPIResponse.code === "200000" &&
        tokenAPIResponse.data?.instanceServers?.length > 0
      ) {
        const serverInfo = tokenAPIResponse.data.instanceServers[0];
        const token = tokenAPIResponse.data.token;

        console.log("KuCoin WS: Token received:", token);
        console.log("KuCoin WS: Endpoint:", serverInfo.endpoint);
        console.log("KuCoin WS: Ping Interval:", serverInfo.pingInterval, "Ping Timeout:", serverInfo.pingTimeout);

        currentPingInterval.current = serverInfo.pingInterval;
        currentPingTimeout.current = serverInfo.pingTimeout;

        connectId.current = `tradeflow-${Date.now()}`;
        console.log("KuCoin WS: Generated connectId:", connectId.current);

        const wsUrl = `${serverInfo.endpoint}?token=${token}&connectId=${connectId.current}`;
        console.log("KuCoin WS: Constructed WebSocket URL:", wsUrl);

        setWebsocketStatus("connecting_ws");
        console.log("KuCoin WS: Attempting to connect to WebSocket at", wsUrl);
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
          console.log("KuCoin WS: WebSocket connection opened.");
          // KuCoin sends a 'welcome' message upon successful connection before client subscribes.
          // We don't set status to 'welcomed' or 'connected' here yet, wait for 'welcome' msg.
          // setWebsocketStatus('welcomed'); // Wait for welcome message from server
        };

        socketRef.current.onmessage = (event: MessageEvent) => {
          console.log("KuCoin WS: Raw message received:", event.data);
          try {
            const message = JSON.parse(event.data as string) as IncomingKucoinWebSocketMessage;
            console.log("KuCoin WS: Parsed message:", message);

            switch (message.type) {
              case "welcome":
                const welcomeMsg = message as KucoinWelcomeMessage;
                console.log("KuCoin WS: Received 'welcome' message with ID:", welcomeMsg.id);
                if (welcomeMsg.id === connectId.current) {
                  console.log("KuCoin WS: Welcome message ID matches connectId. Connection established.");
                  setWebsocketStatus('welcomed');
                  
                  // Subscribe to all market tickers
                  currentSubscriptionRequestId.current = `sub-${Date.now()}`;
                  const payload = {
                    id: currentSubscriptionRequestId.current,
                    type: "subscribe",
                    topic: "/market/ticker:all",
                    privateChannel: false, // Public channel
                    response: true, // Request an ack
                  };
                  console.log("KuCoin WS: Sending subscription request:", payload);
                  socketRef.current?.send(JSON.stringify(payload));
                  setWebsocketStatus('subscribing');
                  startPingPong(); // Start ping/pong after welcome and before/during subscribe
                } else {
                  console.warn("KuCoin WS: Welcome message ID mismatch. Expected:", connectId.current, "Got:", welcomeMsg.id);
                }
                break;

              case "ack":
                const ackMsg = message as KucoinAckMessage;
                console.log("KuCoin WS: Received 'ack' message for ID:", ackMsg.id);
                if (ackMsg.id === currentSubscriptionRequestId.current) {
                  console.log("KuCoin WS: Subscription to /market/ticker:all acknowledged.");
                  setWebsocketStatus('subscribed');
                } else {
                   console.warn("KuCoin WS: Received ack for an unexpected ID:", ackMsg.id);
                }
                break;
              
              case "pong":
                const pongMsg = message as KucoinPongMessage;
                console.log("KuCoin WS: Received 'pong' for ping ID:", pongMsg.id);
                if (pingTimeoutId.current) {
                    clearTimeout(pingTimeoutId.current);
                    pingTimeoutId.current = null;
                    console.log("KuCoin WS: Ping timeout cleared by pong.");
                }
                break;

              case "message": // This will be for ticker data
                if (message.topic === "/market/ticker:all") {
                  const tickerMsg = message as KucoinTickerMessageAll;
                  const symbol = tickerMsg.subject;
                  const rawData = tickerMsg.data;
                  console.log(`KuCoin WS: Received ticker update for symbol: ${symbol}`);
                  
                  const displayData: DisplayTickerData = {
                    symbol: symbol,
                    lastPrice: parseFloatSafe(rawData.last || rawData.price),
                    buyPrice: parseFloatSafe(rawData.buy || rawData.bestBid),
                    sellPrice: parseFloatSafe(rawData.sell || rawData.bestAsk),
                    changeRate24h: parseFloatSafe(rawData.changeRate),
                    changePrice24h: parseFloatSafe(rawData.changePrice),
                    high24h: parseFloatSafe(rawData.high),
                    low24h: parseFloatSafe(rawData.low),
                    volume24h: parseFloatSafe(rawData.vol),
                    bestBid: parseFloatSafe(rawData.bestBid || rawData.buy),
                    bestBidSize: parseFloatSafe(rawData.bestBidSize),
                    bestAsk: parseFloatSafe(rawData.bestAsk || rawData.sell),
                    bestAskSize: parseFloatSafe(rawData.bestAskSize),
                    size: parseFloatSafe(rawData.size),
                    lastUpdate: rawData.Time ? new Date(rawData.Time) : new Date(),
                    sequence: rawData.sequence,
                  };
                  // console.log(`KuCoin WS: Parsed DisplayTickerData for ${symbol}:`, displayData);

                  setTickers((prevTickers) => ({
                    ...prevTickers,
                    [symbol]: displayData,
                  }));
                } else {
                  console.warn("KuCoin WS: Received message on unhandled topic:", message.topic, message);
                }
                break;
              
              case "error": // KuCoin specific error message from server
                const kucoinError = message as KucoinErrorMessage;
                const errorLog = `KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`;
                if (kucoinError.code === "401" && typeof kucoinError.data === 'string' && kucoinError.data.trim().toLowerCase().includes("token is invalid")) {
                  console.warn(`KuCoin WS: Expected error due to token issue (likely simulated/expired) - ${errorLog}`);
                  // If token is invalid, we might not want to auto-reconnect immediately or at all with the same token.
                  // For now, we set to 'error' and onclose will handle generic reconnect scheduling.
                } else {
                  console.error(errorLog);
                }
                setWebsocketStatus('error');
                // Depending on error, may want to close socket if server doesn't
                // if (kucoinError.code === "401") {
                //   socketRef.current?.close(); // Server might close it anyway
                // }
                break;

              default:
                console.warn("KuCoin WS: Unhandled message type:", (message as any).type, message);
            }
          } catch (err) {
            console.error("KuCoin WS: Error parsing message data:", err, "Raw data:", event.data);
          }
        };

        socketRef.current.onerror = (event: Event) => {
          console.error("KuCoin WS: General WebSocket error event:", event.type, event);
          setWebsocketStatus('error');
          // onclose will usually follow and handle reconnect logic
        };

        socketRef.current.onclose = (event: CloseEvent) => {
          console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
          stopPingPong();
          setWebsocketStatus('disconnected');
          if (!isClosing.current) { // Don't reconnect if unmounting
            scheduleReconnect();
          }
        };
      } else {
        console.error("KuCoin WS: Invalid or unsuccessful token API response:", tokenAPIResponse);
        setWebsocketStatus("error");
        scheduleReconnect();
      }
    } catch (error) {
      console.error("KuCoin WS: Error fetching or processing KuCoin token:", error);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPingPong, stopPingPong]); // scheduleReconnect is not added to avoid cycle, it uses fetchTokenAndConnect

  useEffect(() => {
    console.log("KuCoin WS: Initializing connection and effect.");
    isClosing.current = false;
    fetchTokenAndConnect();

    return () => {
      console.log("KuCoin WS: Cleaning up KuCoinAllTickersSocket hook...");
      isClosing.current = true;
      stopPingPong();
      if (socketRef.current) {
        console.log("KuCoin WS: Closing WebSocket connection due to component unmount or effect re-run.");
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null; // Prevent onclose from triggering reconnect during unmount
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [fetchTokenAndConnect, stopPingPong]);

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  // Log processed tickers when they change (for debugging data flow to UI)
  // useEffect(() => {
  //   if (Object.keys(tickers).length > 0) {
  //     console.log("KuCoin WS: Processed tickers updated in hook, count:", processedTickers.length, processedTickers.slice(0,2));
  //   }
  // }, [processedTickers, tickers]);


  return { processedTickers, websocketStatus };
}
