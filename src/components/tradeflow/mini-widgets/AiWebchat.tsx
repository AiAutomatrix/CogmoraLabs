
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
    <script src="https://cdn.botpress.cloud/webchat/v2.5/inject.js"></script>
    <script src="https://files.bpcontent.cloud/2025/05/14/23/20250514232436-UD08HCV3.js"></script>

    <script>
    window.addEventListener('load', function () {
        if (typeof window.botpress !== 'undefined' && typeof window.botpress.open === 'function') {
            console.log('Botpress SDK found, attempting to open chat.');
            window.botpress.open();
        } else {
            console.error('Botpress SDK (window.botpress or window.botpress.open) not found after iframe load. Chat may not initialize or open.');
            // For debugging, check if the core Botpress object from inject.js is present
            if (typeof window.botpressWebChat !== 'undefined' && typeof window.botpressWebChat.init === 'function') {
                 console.log('window.botpressWebChat.init seems to exist. The bot-specific script (files.bpcontent.cloud) should have called it. If window.botpress is still undefined, the bot-specific script might have failed or changed behavior.');
            } else {
                 console.error('window.botpressWebChat.init does not exist. The base Botpress inject.js (cdn.botpress.cloud) might have failed to load or changed.');
            }
        }
    });
    </script>
    </body>
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
