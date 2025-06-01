
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
      console.log('AiWebchat: Page loaded. Checking for window.botpress...');
      if (window.botpress && typeof window.botpress.open === 'function') {
        console.log('AiWebchat: window.botpress.open is available. Opening chat.');
        try {
          window.botpress.open();
        } catch (e) {
          console.error('AiWebchat: Error calling window.botpress.open():', e);
        }
      } else {
        console.error('AiWebchat: window.botpress or window.botpress.open is not available.');
        if(window.botpress) {
          console.log('AiWebchat: window.botpress object exists, but "open" method is missing. Botpress object:', window.botpress);
        } else {
          console.log('AiWebchat: window.botpress object itself is missing.');
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
