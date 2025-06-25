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
      <div id="webchat"></div>

      
      <script src="https://cdn.botpress.cloud/webchat/v3.0/inject.js" defer></script>
      <script src="https://files.bpcontent.cloud/2025/06/25/16/20250625163528-WAZ2CJ43.js" defer></script>
    
      
      <script>
        window.addEventListener("load", () => {
          console.log("✅ iframe loaded — waiting for botpress...");

          const tryOpenWebchat = () => {
            if (window.botpress && typeof window.botpress.open === 'function') {
              window.botpress.open();
              console.log("🟢 Called botpress.open()");

              if (typeof window.botpress.sendEvent === 'function') {
                window.botpress.sendEvent({ type: 'show' });
                console.log("🟢 Sent botpress.sendEvent({ type: 'show' })");
              }
            } else {
              console.log("⏳ botpress not ready yet, retrying...");
              setTimeout(tryOpenWebchat, 300);
            }
          };

          setTimeout(tryOpenWebchat, 300);
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
