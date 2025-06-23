
'use client';

import React, { useMemo } from 'react';

const BotpressIframePage = () => {
  const botpressSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Botpress Webchat</title>
      <style>
        html, body {
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      <div id="webchat" />
      
      <!-- Load Botpress webchat script (v2.5) -->
    
    
    <script src="https://cdn.botpress.cloud/webchat/v3.0/inject.js" defer></script>
    <script src="https://files.bpcontent.cloud/2025/06/23/16/20250623161452-3OQKFSWN.js" defer></script>
    <script>
    // Your existing command (works in Studio)
    window.botpress.open();
    // Fallback for production (if first command fails)
    if (typeof window.botpressWebChat !== 'undefined') {
    window.botpressWebChat.sendEvent({ type: 'show' });
    }
    </script>

    </html>
  `, []);

  return (
    <iframe
      srcDoc={botpressSrcDoc}
      title="Botpress Webchat"
      className="w-full h-full border-0"
      allow="microphone"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  );
};

export default BotpressIframePage;
