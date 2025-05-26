
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

const RECONNECT_DELAY_MS = 5000;

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
  const isClosing = useRef<boolean>(false);

  const currentPingInterval = useRef<number>(18000); // Default, will be updated by server
  const currentPingTimeout = useRef<number>(10000);  // Default, will be updated by server

  const stopPingPong = useCallback(() => {
    if (pingIntervalId.current) {
      clearInterval(pingIntervalId.current);
      pingIntervalId.current = null;
      console.log("KuCoin WS: Ping interval cleared.");
    }
    if (pingTimeoutId.current) {
      clearTimeout(pingTimeoutId.current);
      pingTimeoutId.current = null;
      console.log("KuCoin WS: Ping timeout cleared by stopPingPong.");
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    console.log(`KuCoin WS: Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
    stopPingPong();
    if (socketRef.current) {
        console.log("KuCoin WS: Closing existing socket before reconnect attempt.");
        // Nullify handlers to prevent them from firing during or after explicit close
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
    }
    setTimeout(() => {
      if (!isClosing.current) {
        console.log("KuCoin WS: Attempting to reconnect...");
        // fetchTokenAndConnect is defined below and part of the hook's closure, so this is fine.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        fetchTokenAndConnect();
      } else {
        console.log("KuCoin WS: Reconnect aborted as component is unmounting.");
      }
    }, RECONNECT_DELAY_MS);
  }, [stopPingPong]); // fetchTokenAndConnect will be added to deps by ESLint if needed, or wrapped if static

  const startPingPong = useCallback(() => {
    console.log(`KuCoin WS: Starting ping mechanism. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    stopPingPong(); 

    pingIntervalId.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`;
        console.log(`KuCoin WS: Sending ping with ID: ${pingId}`);
        socketRef.current.send(JSON.stringify({ id: pingId, type: "ping" }));

        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn(`KuCoin WS: Ping timeout! No pong received for last ping. Closing socket.`);
          socketRef.current?.close(); 
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, [stopPingPong]);


  const fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket connection attempt already in progress or open.");
      return;
    }
    isClosing.current = false;
    setWebsocketStatus("fetching_token");
    console.log("KuCoin WS: Attempting to fetch public WebSocket token...");

    try {
      const response = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
        method: "POST",
      });
      console.log("KuCoin WS: Token API raw response status:", response.status);
      const responseText = await response.text();
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
          setWebsocketStatus('welcomed'); // Connection is open, waiting for "welcome" message from server
                                        // As per docs, welcome msg confirms server readiness
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
                  console.log("KuCoin WS: Welcome message ID matches connectId. Connection established and welcomed by server.");
                  setWebsocketStatus('welcomed'); // Confirmed welcome
                  
                  currentSubscriptionRequestId.current = `sub-${Date.now()}`;
                  const payload = {
                    id: currentSubscriptionRequestId.current, 
                    type: "subscribe",
                    topic: "/market/ticker:all",
                    privateChannel: false,
                    response: true,
                  };
                  console.log("KuCoin WS: Sending subscription request:", payload);
                  socketRef.current?.send(JSON.stringify(payload));
                  setWebsocketStatus('subscribing');
                  startPingPong(); 
                } else {
                  console.warn("KuCoin WS: Welcome message ID mismatch. Expected:", connectId.current, "Got:", welcomeMsg.id, ". Closing socket.");
                  socketRef.current?.close();
                }
                break;

              case "ack":
                const ackMsg = message as KucoinAckMessage;
                console.log("KuCoin WS: Received 'ack' message for ID:", ackMsg.id);
                if (ackMsg.id === currentSubscriptionRequestId.current) {
                  console.log("KuCoin WS: Subscription to /market/ticker:all acknowledged.");
                  setWebsocketStatus('subscribed');
                } else {
                   console.warn("KuCoin WS: Received ack for an unexpected ID:", ackMsg.id, "Expected:", currentSubscriptionRequestId.current);
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

              case "message":
                if (message.topic === "/market/ticker:all") {
                  const tickerMsg = message as KucoinTickerMessageAll;
                  const symbol = tickerMsg.subject;
                  const rawData = tickerMsg.data;
                  console.log(`KuCoin WS: Received ticker update for symbol: ${symbol}`);
                  
                  const displayData: DisplayTickerData = {
                    symbol: symbol,
                    lastPrice: parseFloatSafe(rawData.last),
                    buyPrice: parseFloatSafe(rawData.buy),
                    sellPrice: parseFloatSafe(rawData.sell),
                    changeRate24h: parseFloatSafe(rawData.changeRate),
                    changePrice24h: parseFloatSafe(rawData.changePrice),
                    high24h: parseFloatSafe(rawData.high),
                    low24h: parseFloatSafe(rawData.low),
                    volume24h: parseFloatSafe(rawData.vol),
                    bestBid: parseFloatSafe(rawData.bestBid),
                    bestBidSize: parseFloatSafe(rawData.bestBidSize),
                    bestAsk: parseFloatSafe(rawData.bestAsk),
                    bestAskSize: parseFloatSafe(rawData.bestAskSize),
                    size: parseFloatSafe(rawData.size),
                    lastUpdate: rawData.Time ? new Date(rawData.Time) : new Date(),
                    sequence: rawData.sequence,
                  };
                  
                  setTickers((prevTickers) => ({
                    ...prevTickers,
                    [symbol]: displayData,
                  }));
                } else {
                  console.warn("KuCoin WS: Received message on unhandled topic:", message.topic, message);
                }
                break;
              
              case "error":
                const kucoinError = message as KucoinErrorMessage;
                const errorDataStr = typeof kucoinError.data === 'string' ? kucoinError.data.trim().toLowerCase() : '';
                if (kucoinError.code === "401" && errorDataStr.includes("token is invalid")) {
                    console.warn(`KuCoin WS: Expected error due to (likely simulated/expired) token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
                    // For an invalid token, we might not want to immediately reconnect with the same logic,
                    // as it would just fetch another (simulated) invalid token.
                    // For now, just set error status. The onclose will handle generic reconnect scheduling.
                } else {
                    console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
                }
                setWebsocketStatus('error'); 
                // KuCoin might close the connection on critical errors like 401.
                // If not, we might consider closing it: if (kucoinError.code === "401") socketRef.current?.close();
                break;

              default:
                console.warn("KuCoin WS: Unhandled message type:", (message as any).type, message);
            }
          } catch (err) {
            console.error("KuCoin WS: Error parsing message data:", err, "Raw data:", event.data);
          }
        };

        socketRef.current.onerror = (event: Event) => {
          console.error("KuCoin WS: General WebSocket error event:", event.type, "Full event object:", event);
          setWebsocketStatus('error');
          // Connection will likely close, onclose will handle reconnect
        };

        socketRef.current.onclose = (event: CloseEvent) => {
          console.warn(`KuCoin WS: Connection closed. Code: ${event.code}, Reason: ${event.reason || "No reason given"}, Clean: ${event.wasClean}`);
          stopPingPong();
          setWebsocketStatus('disconnected');
          if (!isClosing.current) {
            console.log("KuCoin WS: onclose triggered scheduleReconnect.");
            scheduleReconnect();
          } else {
            console.log("KuCoin WS: onclose: isClosing is true, not reconnecting.");
          }
        };
      } else {
        console.error("KuCoin WS: Invalid or unsuccessful token API response:", tokenAPIResponse);
        setWebsocketStatus("error");
        scheduleReconnect();
      }
    } catch (error) {
      console.error("KuCoin WS: Error during token fetch or initial connection setup:", error);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPingPong, stopPingPong, scheduleReconnect]); 
  // scheduleReconnect is memoized and won't cause re-runs unless its own deps change.
  // startPingPong and stopPingPong are also memoized.

  useEffect(() => {
    console.log("KuCoin WS: Initializing connection and effect.");
    isClosing.current = false;
    fetchTokenAndConnect();

    return () => {
      console.log("KuCoin WS: Cleaning up KuCoinAllTickersSocket hook...");
      isClosing.current = true;
      stopPingPong();
      if (socketRef.current) {
        console.log("KuCoin WS: Closing WebSocket connection explicitly due to component unmount or effect re-run.");
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null; 
        socketRef.current.close();
        socketRef.current = null;
        console.log("KuCoin WS: WebSocket closed and ref nulled.");
      }
    };
  }, [fetchTokenAndConnect, stopPingPong]);

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
