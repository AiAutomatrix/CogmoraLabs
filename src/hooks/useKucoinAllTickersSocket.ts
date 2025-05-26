
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

  // Forward declaration for ESLint
  let fetchTokenAndConnect: () => Promise<void>;

  const scheduleReconnect = useCallback(() => {
    console.log(`KuCoin WS: Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
    stopPingPong();
    if (socketRef.current) {
        console.log("KuCoin WS: Closing existing socket before reconnect attempt.");
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
        console.log("KuCoin WS: Reconnect aborted as component is unmounting or connect function not ready.");
      }
    }, RECONNECT_DELAY_MS);
  }, [stopPingPong]); // fetchTokenAndConnect will be added later or handled by its definition scope

  const startPingPong = useCallback(() => {
    console.log(`KuCoin WS: Starting ping mechanism. Interval: ${currentPingInterval.current}ms, Timeout: ${currentPingTimeout.current}ms`);
    stopPingPong(); 

    pingIntervalId.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const pingId = `ping-${Date.now()}`;
        console.log(`KuCoin WS: Sending ping with ID: ${pingId}`);
        try {
          socketRef.current.send(JSON.stringify({ id: pingId, type: "ping" }));
        } catch (err) {
          console.error("KuCoin WS: Error sending ping:", err);
          // Potentially close and reconnect if send fails
        }
        
        if (pingTimeoutId.current) clearTimeout(pingTimeoutId.current);
        pingTimeoutId.current = setTimeout(() => {
          console.warn(`KuCoin WS: Ping timeout! No pong received for last ping (ID: ${pingId}). Closing socket.`);
          socketRef.current?.close(); 
        }, currentPingTimeout.current);
      }
    }, currentPingInterval.current);
  }, [stopPingPong]);


  fetchTokenAndConnect = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      console.log("KuCoin WS: WebSocket connection attempt already in progress or open.");
      return;
    }
    isClosing.current = false;
    setWebsocketStatus("fetching_token");
    console.log("KuCoin WS: Attempting to fetch KuCoin WebSocket token...");

    try {
      // --- START: SIMULATED API call ---
      console.log("KuCoin WS: USING SIMULATED TOKEN FETCH.");
      // Simulating a successful API response structure based on KuCoin documentation
      const simulatedTokenAPIResponse: KucoinTokenResponse = {
        code: "200000",
        data: {
          token: "SIMULATED_TOKEN_f4k3_t0k3n_f0r_d3v_purp0s3s_SIMULATED_TOKEN",
          instanceServers: [
            {
              endpoint: "wss://ws-api-spot.kucoin.com/", // Using a base public KuCoin Spot WS endpoint
              protocol: "websocket",
              encrypt: true,
              pingInterval: 18000, // Typical value from docs
              pingTimeout: 10000,  // Typical value from docs
            },
          ],
        },
      };
      // --- END: SIMULATED API call ---
      
      // --- ACTUAL API Call (Commented out to avoid CORS/fetch issues in current environment) ---
      // const response = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
      //   method: "POST",
      // });
      // console.log("KuCoin WS: Token API raw response status:", response.status);
      // if (!response.ok) {
      //   const errorBody = await response.text();
      //   console.error(`KuCoin WS: Token API error response body: ${errorBody}`);
      //   throw new Error(`Failed to fetch KuCoin token: ${response.status} - ${errorBody}`);
      // }
      // const tokenAPIResponse: KucoinTokenResponse = await response.json();
      // console.log("KuCoin WS: Token API raw response JSON:", tokenAPIResponse);
      // --- END ACTUAL API Call ---
      
      // Use the simulated response:
      const tokenAPIResponse = simulatedTokenAPIResponse;


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

        // Ensure endpoint doesn't already have /endpoint if base is wss://ws-api-spot.kucoin.com/
        let endpointUrl = serverInfo.endpoint.endsWith('/') ? serverInfo.endpoint : `${serverInfo.endpoint}/`;
        const wsUrl = `${endpointUrl}?token=${token}&connectId=${connectId.current}`;
        
        console.log("KuCoin WS: Constructed WebSocket URL:", wsUrl);

        setWebsocketStatus("connecting_ws");
        console.log("KuCoin WS: Attempting to connect to WebSocket at", wsUrl);
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
          console.log("KuCoin WS: WebSocket connection opened. Waiting for 'welcome' message...");
          // Status will be updated to 'welcomed' upon receiving the welcome message.
          setWebsocketStatus('connecting_ws'); // Still connecting until welcome
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
                  const symbol = tickerMsg.subject; // Symbol is in the subject for /market/ticker:all
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
                    bestBid: parseFloatSafe(rawData.bestBid), // Assuming these are part of /ticker:all stream
                    bestBidSize: parseFloatSafe(rawData.bestBidSize),
                    bestAsk: parseFloatSafe(rawData.bestAsk),
                    bestAskSize: parseFloatSafe(rawData.bestAskSize),
                    size: parseFloatSafe(rawData.size), // Last trade size
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
              
              case "error": // This is a KuCoin specific error message type
                const kucoinError = message as KucoinErrorMessage;
                // Check for the specific "token is invalid" error
                if (kucoinError.code === "401" && typeof kucoinError.data === 'string' && kucoinError.data.trim().toLowerCase().includes("token is invalid")) {
                  console.warn(`KuCoin WS: Expected error due to simulated/invalid token - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
                } else {
                  console.error(`KuCoin WS: Error Message Received - Code: ${kucoinError.code}, Data: ${kucoinError.data}, ID: ${kucoinError.id || 'N/A'}`);
                }
                setWebsocketStatus('error'); 
                if (kucoinError.code === "401") { 
                  // For invalid token, we might not want to immediately reconnect with the same logic.
                  // For now, the onclose handler will attempt a generic reconnect.
                  console.log("KuCoin WS: Invalid token error, connection will likely close.");
                }
                break;

              default:
                console.warn("KuCoin WS: Unhandled message type:", (message as any).type, message);
            }
          } catch (err) {
            console.error("KuCoin WS: Error parsing message data:", err, "Raw data:", event.data);
          }
        };

        socketRef.current.onerror = (event: Event) => {
          console.error("KuCoin WS: General WebSocket error event. Type:", event.type, "Full event object (check browser console for details):", event);
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
        console.error("KuCoin WS: Invalid or unsuccessful token API response (simulated or real):", tokenAPIResponse);
        setWebsocketStatus("error");
        scheduleReconnect();
      }
    } catch (error) {
      console.error("KuCoin WS: Error during token fetch or initial connection setup:", error);
      setWebsocketStatus("error");
      scheduleReconnect();
    }
  }, [startPingPong, stopPingPong, scheduleReconnect]); 
  

  useEffect(() => {
    console.log("KuCoin WS: Initializing KuCoinAllTickersSocket hook and effect.");
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
  }, [fetchTokenAndConnect, stopPingPong]); // Added stopPingPong as a dependency

  const processedTickers = useMemo(() => 
    Object.values(tickers)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)), 
  [tickers]);

  return { processedTickers, websocketStatus };
}
