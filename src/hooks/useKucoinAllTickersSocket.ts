
'use client';

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

const RECONNECT_DELAY_MS = 5000; // 5 seconds
const SIMULATED_PING_INTERVAL = 18000; // KuCoin usually suggests ~18-20s for public
const SIMULATED_PING_TIMEOUT = 10000;  // KuCoin usually suggests ~10s

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
  const isClosing = useRef<boolean>(false); // To prevent reconnect on intentional close

  // Store server-provided ping settings
  const currentPingInterval = useRef<number>(SIMULATED_PING_INTERVAL);
  const currentPingTimeout = useRef<number>(SIMULATED_PING_TIMEOUT);

  // Forward declaration for ESLint
  let fetchTokenAndConnect: () => Promise<void>;

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
    stopPingPong(); // Stop any existing ping/pong before trying to reconnect

    if (socketRef.current) {
        console.log("KuCoin WS: Closing existing socket before reconnect attempt.");
        // Nullify handlers to prevent them from firing on an old socket instance during/after close
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
    }

    setTimeout(() => {
      if (!isClosing.current && fetchTokenAndConnect) {
        console.log("KuCoin WS: Attempting to reconnect...");
        fetchTokenAndConnect();
      } else {
        console.log("KuCoin WS: Reconnect aborted as component is unmounting or intentional closure.");
      }
    }, RECONNECT_DELAY_MS);
  }, [stopPingPong]); // fetchTokenAndConnect will be defined in the same scope

  const startPingPong = useCallback(() => {
    console.log(`KuCoin WS: Starting ping mechanism. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    stopPingPong(); // Clear existing timers

    pingIntervalId.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`;
        console.log(`KuCoin WS: Sending ping with ID: ${pingId}`);
        try {
          socketRef.current.send(JSON.stringify({ id: pingId, type: "ping" }));
        } catch (err) {
          console.error("KuCoin WS: Error sending ping:", err);
        }
        
        // Clear previous timeout before setting a new one
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        
        pingTimeoutId.current = setTimeout(() => {
          console.warn(`KuCoin WS: Ping timeout! No pong received for last ping (ID: ${pingId}). Closing socket.`);
          socketRef.current?.close(); // This will trigger onclose and attempt reconnect
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, [stopPingPong]);


  fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket connection attempt already in progress or open.");
      return;
    }
    isClosing.current = false; // Reset intentional close flag
    setWebsocketStatus("fetching_token");
    console.log("KuCoin WS: Attempting to fetch KuCoin WebSocket token (Simulated)...");

    // Simulate API call to /api/v1/bullet-public
    // In a real app, this would be:
    // try {
    //   const response = await fetch("https://api.kucoin.com/api/v1/bullet-public", { method: "POST" });
    //   console.log("KuCoin WS: Token API raw response status:", response.status);
    //   if (!response.ok) {
    //     const errorBody = await response.text();
    //     console.error(`KuCoin WS: Token API error response body: ${errorBody}`);
    //     throw new Error(`Failed to fetch KuCoin token: ${response.status} - ${errorBody}`);
    //   }
    //   const tokenAPIResponse: KucoinTokenResponse = await response.json();
    //   console.log("KuCoin WS: Token API raw response JSON:", tokenAPIResponse);
    //   // ... rest of the logic using tokenAPIResponse ...
    // } catch (error) {
    //   console.error("KuCoin WS: Error fetching token:", error);
    //   setWebsocketStatus("error");
    //   scheduleReconnect();
    //   return;
    // }

    // Using simulated data:
    const simulatedTokenAPIResponse: KucoinTokenResponse = {
      code: "200000",
      data: {
        token: "SIMULATED_TOKEN_f4k3_t0k3n_f0r_d3v_purp0s3s_SIMULATED_TOKEN",
        instanceServers: [
          {
            endpoint: "wss://ws-api-spot.kucoin.com/endpoint", // Using actual public Spot WS endpoint base
            protocol: "websocket",
            encrypt: true,
            pingInterval: SIMULATED_PING_INTERVAL, // e.g., 18000 ms from docs
            pingTimeout: SIMULATED_PING_TIMEOUT,   // e.g., 10000 ms from docs
          },
        ],
      },
    };
    
    console.log("KuCoin WS: Simulated token response:", simulatedTokenAPIResponse);

    if (
      simulatedTokenAPIResponse.code === "200000" &&
      simulatedTokenAPIResponse.data?.instanceServers?.length > 0
    ) {
      const serverInfo = simulatedTokenAPIResponse.data.instanceServers[0];
      const token = simulatedTokenAPIResponse.data.token;

      currentPingInterval.current = serverInfo.pingInterval;
      currentPingTimeout.current = serverInfo.pingTimeout;

      connectId.current = `tradeflow-${Date.now()}`;
      console.log("KuCoin WS: Generated connectId:", connectId.current);
      
      // Ensure endpoint doesn't double up on '/endpoint' if base already has it
      let endpointBase = serverInfo.endpoint;
      if (endpointBase.endsWith('/endpoint')) {
          endpointBase = endpointBase.substring(0, endpointBase.length - '/endpoint'.length);
      }
      if (!endpointBase.endsWith('/')) {
          endpointBase += '/';
      }

      const wsUrl = `${endpointBase}?token=${token}&connectId=${connectId.current}`;
      console.log("KuCoin WS: Constructed WebSocket URL:", wsUrl);

      setWebsocketStatus("connecting_ws");
      console.log("KuCoin WS: Attempting to connect to WebSocket at", wsUrl);
      
      try {
        socketRef.current = new WebSocket(wsUrl);
      } catch (e) {
        console.error("KuCoin WS: Error creating WebSocket instance:", e);
        setWebsocketStatus("error");
        scheduleReconnect();
        return;
      }

      socketRef.current.onopen = () => {
        console.log("KuCoin WS: WebSocket connection opened. Waiting for 'welcome' message.");
        // Status remains 'connecting_ws' until "welcome" is received
        setWebsocketStatus('connecting_ws'); 
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
                
                currentSubscriptionRequestId.current = `sub-${Date.now()}`;
                const subscribePayload = {
                  id: currentSubscriptionRequestId.current, 
                  type: "subscribe",
                  topic: "/market/ticker:all",
                  privateChannel: false,
                  response: true,
                };
                console.log("KuCoin WS: Sending subscription request:", subscribePayload);
                socketRef.current?.send(JSON.stringify(subscribePayload));
                setWebsocketStatus('subscribing');
                startPingPong(); 
              } else {
                console.warn("KuCoin WS: Welcome message ID mismatch. Expected:", connectId.current, "Got:", welcomeMsg.id, ". Closing socket.");
                socketRef.current?.close(); // Triggers onclose and reconnect
              }
              break;

            case "ack":
              const ackMsg = message as KucoinAckMessage;
              console.log("KuCoin WS: Received 'ack' message for ID:", ackMsg.id);
              if (ackMsg.id === currentSubscriptionRequestId.current) {
                console.log("KuCoin WS: Subscription to /market/ticker:all acknowledged.");
                setWebsocketStatus('subscribed');
              } else {
                 console.warn("KuCoin WS: Received ack for an unexpected ID:", ackMsg.id, "Expected subscription ID:", currentSubscriptionRequestId.current);
              }
              break;
            
            case "pong":
              const pongMsg = message as KucoinPongMessage;
              console.log("KuCoin WS: Received 'pong'. Clearing ping timeout for ping ID:", pongMsg.id);
              if (pingTimeoutId.current) {
                  clearTimeout(pingTimeoutId.current);
                  pingTimeoutId.current = null;
              }
              break;

            case "message":
              if (message.topic === "/market/ticker:all") {
                const tickerMsg = message as KucoinTickerMessageAll;
                const symbol = tickerMsg.subject; 
                const rawData = tickerMsg.data;
                // console.log(`KuCoin WS: Received ticker update for symbol: ${symbol}`);
                
                const displayData: DisplayTickerData = {
                  symbol: symbol,
                  lastPrice: parseFloatSafe(rawData.last),
                  buyPrice: parseFloatSafe(rawData.buy),        // From data.buy
                  sellPrice: parseFloatSafe(rawData.sell),       // From data.sell
                  changeRate24h: parseFloatSafe(rawData.changeRate),// From data.changeRate
                  changePrice24h: parseFloatSafe(rawData.changePrice),// From data.changePrice
                  high24h: parseFloatSafe(rawData.high),         // From data.high
                  low24h: parseFloatSafe(rawData.low),          // From data.low
                  volume24h: parseFloatSafe(rawData.vol),        // From data.vol
                  bestBid: parseFloatSafe(rawData.bestBid),      // Not in /market/ticker:all data structure, but present in specific ticker /market/ticker:SYMBOL
                  bestBidSize: parseFloatSafe(rawData.bestBidSize),// Same as above
                  bestAsk: parseFloatSafe(rawData.bestAsk),      // Same as above
                  bestAskSize: parseFloatSafe(rawData.bestAskSize),// Same as above
                  size: parseFloatSafe(rawData.size),            // Last trade size, may not be in /market/ticker:all
                  lastUpdate: rawData.Time ? new Date(rawData.Time) : new Date(), // Time is present
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
              if (kucoinError.code === "401") {
                console.warn(`KuCoin WS: Expected 401 error (likely due to simulated/invalid token) - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              } else {
                console.error(`KuCoin WS: Unexpected Server Error Message - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
              }
              setWebsocketStatus('error'); 
              // Note: KuCoin might close the connection after sending a 401 error.
              // The onclose handler will attempt reconnection if !isClosing.current.
              // To prevent hammering the API with an invalid token, a more sophisticated
              // error handling might be needed for real tokens (e.g., stop reconnect after several 401s).
              break;

            default:
              console.warn("KuCoin WS: Unhandled message type:", (message as any).type, message);
          }
        } catch (err) {
          console.error("KuCoin WS: Error parsing message data:", err, "Raw data:", event.data);
        }
      };

      socketRef.current.onerror = (event: Event) => {
        console.error("KuCoin WS: General WebSocket error event. Type:", event.type, "Details in browser console. This usually means the connection could not be established (e.g., wrong URL, network issue, or server rejected immediately).");
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
      console.error("KuCoin WS: Invalid or unsuccessful token API response (Simulated):", simulatedTokenAPIResponse);
      setWebsocketStatus("error");
      scheduleReconnect(); // Attempt to fetch token again
    }
  }, [startPingPong, stopPingPong, scheduleReconnect]); 

  useEffect(() => {
    console.log("KuCoin WS: Initializing KuCoinAllTickersSocket hook and effect.");
    isClosing.current = false; // Ensure it's false on mount/re-run
    fetchTokenAndConnect();

    return () => {
      console.log("KuCoin WS: Cleaning up KuCoinAllTickersSocket hook...");
      isClosing.current = true; // Set flag to prevent reconnect on unmount
      stopPingPong();
      if (socketRef.current) {
        console.log("KuCoin WS: Closing WebSocket connection explicitly due to component unmount or effect re-run.");
        // Prevent onclose from triggering reconnect during intentional close
        socketRef.current.onclose = () => {
          console.log("KuCoin WS: WebSocket intentionally closed during cleanup.");
        };
        socketRef.current.close();
        socketRef.current = null;
        console.log("KuCoin WS: WebSocket closed and ref nulled.");
      }
    };
  }, [fetchTokenAndConnect]);

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
