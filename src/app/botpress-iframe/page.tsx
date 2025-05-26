
'use client';

import React, { useEffect } from 'react';

declare global {
  interface Window {
    botpressWebChat?: {
      init: (config: any) => void;
      open: () => void;
      onEvent?: (callback: (event: any) => void, eventTypes?: string[]) => void;
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
        console.log("Botpress script already loaded, but webChat object not ready. Waiting for init.");
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
          
          // UI Customizations (as per your example)
          containerWidth: '100%',
          layoutWidth: '100%',
          hideWidget: true, // Start hidden, then programmatically open
          showCloseButton: true, // Or false, depending on desired UX
          disableAnimations: false,
          closeOnEscape: false,
          showConversationsButton: false,
          enableTranscriptDownload: false,
          
          // Additional common settings
          lazySocket: true,
          themeName: 'prism', // Or your preferred theme
          frontendVersion: 'v1',
          showPoweredBy: false,
          enableConversationDeletion: true,
        });
        console.log("Botpress initialized.");

        // Try to open the chat
        // For v1, often just calling open() after init is enough.
        // If it needs to wait for a specific event, that's more complex.
        // Let's try a direct open first.
        if (typeof window.botpressWebChat.open === 'function') {
          window.botpressWebChat.open();
          console.log("Botpress chat.open() called.");
        } else {
          console.error("window.botpressWebChat.open is not a function after init.");
        }

        // Fallback: if open() is not immediately available, try with onEvent for LIFECYCLE.LOADED
        // This is more common with v2.x but good to have as a robust measure
        if (window.botpressWebChat.onEvent) {
            window.botpressWebChat.onEvent(() => {
                if (typeof window.botpressWebChat.open === 'function') {
                    console.log("Botpress LIFECYCLE.LOADED, attempting to open chat.");
                    window.botpressWebChat.open();
                } else {
                    console.error("Botpress LIFECYCLE.LOADED, but open function still not available.");
                }
            }, ['LIFECYCLE.LOADED']);
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
      // Cleanup if the script was added by this component instance
      // Note: Botpress might inject its own UI elements outside this script's direct control.
      // A full cleanup might require more specific Botpress API calls if available, or manual DOM removal.
      if (script.parentNode) {
        document.body.removeChild(script);
        console.log("Botpress inject.js script removed from iframe.");
      }
      // Attempt to find and remove the Botpress container if it exists
      const bpContainer = document.getElementById('botpress-webchat-container'); // Default Botpress container ID
      if (bpContainer && bpContainer.parentNode) {
        bpContainer.parentNode.removeChild(bpContainer);
        console.log("Attempted to remove Botpress webchat container.");
      }
    };
  }, []);

  return (
    // This div is where Botpress will inject its webchat UI.
    // It needs to be present in the DOM for Botpress to target.
    <div id="botpress-webchat-container" className="w-full h-full" />
  );
};

export default BotpressIframePage;
