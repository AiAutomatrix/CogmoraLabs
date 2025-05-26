
'use client';

import React, { useEffect } from 'react';

declare global {
  interface Window {
    botpressWebChat?: {
      init: (config: any) => void;
      open: () => void;
      onEvent?: (callback: (event: any) => void, eventTypes?: string[]) => void; // Added eventTypes for v1
    };
  }
}

const BotpressIframePage: React.FC = () => {
  useEffect(() => {
    // This will be executed inside the iframe
    const existingScript = document.querySelector('script[src="https://cdn.botpress.cloud/webchat/v1/inject.js"]');
    if (existingScript) {
      // If script already exists, assume it's initialized or will be
      if (window.botpressWebChat && typeof window.botpressWebChat.open === 'function') {
        console.log("Botpress script already loaded, attempting to open chat.");
        window.botpressWebChat.open();
      } else {
        console.log("Botpress script already loaded, but webChat object not ready. Waiting for init or LIFECYCLE.LOADED.");
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.botpress.cloud/webchat/v1/inject.js';
    script.async = true;
    script.onload = () => {
      console.log("Botpress v1 inject.js loaded.");
      if (window.botpressWebChat) {
        window.botpressWebChat.init({
          // --- IMPORTANT ---
          // Replace these placeholders with your actual Botpress credentials
          botId: 'YOUR_BOT_ID', // e.g., 'your-bot-id-string'
          clientId: 'YOUR_CLIENT_ID', // e.g., 'some-uuid-for-client-id'
          webhookId: 'YOUR_WEBHOOK_ID', // e.g. 'some-uuid-for-webhook-id'
          // --- END IMPORTANT ---

          hostUrl: 'https://cdn.botpress.cloud/webchat/v1',
          messagingUrl: 'https://messaging.botpress.cloud',
          
          // UI Customizations
          containerWidth: '100%',
          layoutWidth: '100%',
          hideWidget: true, // Important for programmatic open; Botpress v1 often shows widget by default
          showCloseButton: true, 
          disableAnimations: false,
          closeOnEscape: false,
          showConversationsButton: false,
          enableTranscriptDownload: false,
          
          // Additional common settings
          lazySocket: true,
          themeName: 'prism', 
          frontendVersion: 'v1',
          showPoweredBy: false,
          enableConversationDeletion: true,
        });
        console.log("Botpress initialized.");

        // Attempt to open the chat directly
        if (typeof window.botpressWebChat.open === 'function') {
          window.botpressWebChat.open();
          console.log("Botpress chat.open() called directly after init.");
        } else {
          console.error("window.botpressWebChat.open is not a function immediately after init. Will rely on LIFECYCLE.LOADED.");
        }

        // Robust fallback: Listen for LIFECYCLE.LOADED event for v1
        if (window.botpressWebChat.onEvent) {
            console.log("Setting up onEvent listener for LIFECYCLE.LOADED.");
            window.botpressWebChat.onEvent(() => {
                if (typeof window.botpressWebChat?.open === 'function') {
                    console.log("Botpress LIFECYCLE.LOADED event fired, attempting to open chat.");
                    window.botpressWebChat.open();
                } else {
                    console.error("Botpress LIFECYCLE.LOADED, but open function still not available.");
                }
            }, ['LIFECYCLE.LOADED']); // Specify event type for v1
        } else {
            console.warn("window.botpressWebChat.onEvent is not available. Direct open might be the only option.");
        }

      } else {
        console.error("Botpress script loaded, but window.botpressWebChat is not available.");
      }
    };
    script.onerror = () => {
        console.error("Failed to load Botpress v1 inject.js script.");
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
        console.log("Botpress inject.js script removed from iframe.");
      }
      const bpContainer = document.getElementById('botpress-webchat-container');
      if (bpContainer && bpContainer.parentNode) {
        bpContainer.parentNode.removeChild(bpContainer);
        console.log("Attempted to remove Botpress webchat container.");
      }
    };
  }, []);

  return (
    // This div is where Botpress will inject its webchat UI.
    // Botpress v1 typically creates its own container, but having one doesn't hurt.
    <div id="botpress-webchat-container" className="w-full h-full" />
  );
};

export default BotpressIframePage;
