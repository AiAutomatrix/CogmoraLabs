'use client';
import React, { useMemo } from 'react'; // Changed from type import
import type { FC } from 'react';

// The onSymbolSubmit prop is no longer needed as Botpress handles its own interaction.
interface AiWebchatProps {
  // onSymbolSubmit?: (symbol: string) => void; // This prop is removed
}

const AiWebchat: React.FC<AiWebchatProps> = () => {
  const botpressSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Botpress Webchat</title>
      <style>
        body, html { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          overflow: hidden; 
          background-color: transparent; /* Allow parent bg to show if widget is transparent */
        }
        /* Specific targeting for Botpress container if its ID is known, or general full-size attempt */
        /* Common Botpress webchat container ID, might vary */
        #bp-web-widget-container { 
            width: 100% !important; 
            height: 100% !important; 
            border: none !important;
        }
        /* More generic selector if the ID above doesn't work or changes */
        div[id^="bp-web-widget"] {
            width: 100% !important;
            height: 100% !important;
            border: none !important;
        }
      </style>
    </head>
    <body>
      <!-- Botpress injects its UI here -->
      <script src="https://cdn.botpress.cloud/webchat/v2.5/inject.js"></script>
      <script src="https://files.bpcontent.cloud/2025/05/14/23/20250514232436-UD08HCV3.js"></script>
      <script>
        window.addEventListener("load", function () {
          window.botpressWebChat && window.botpressWebChat.open();
        });
      </script>
    </body>
    </html>
  `, []);

  return (
    <iframe
      srcDoc={botpressSrcDoc}
      title="Botpress Webchat"
      className="w-full h-full border-0" // Ensure iframe fills its parent
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      // allowFullScreen // Optional: if your Botpress chat uses fullscreen features
    />
  );
};

export default AiWebchat;
