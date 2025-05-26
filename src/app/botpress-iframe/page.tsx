'use client';

import React, { useMemo } from 'react';

const BotpressIframePage: React.FC = () => {
  // Using useMemo to ensure srcDoc is stable and only re-calculated if dependencies change (none here)
  const botpressSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Botpress Webchat</title>
      <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      </style>
    </head>
    <body>
      <!-- Botpress will inject its UI here or use its default container -->
      
      <script src="https://cdn.botpress.cloud/webchat/v2.5/inject.js"></script>
      <script src="https://files.bpcontent.cloud/2025/05/14/23/20250514232436-UD08HCV3.js"></script>
      
      <script>
        // The user's configuration script (UD08HCV3.js) is expected to handle 
        // the initialization (window.botpressWebChat.init) and opening of the chat.
        // This listener is here to confirm the page load, but the primary logic
        // for display and auto-open should be within UD08HCV3.js or configured
        // in the Botpress studio for that script.
        window.addEventListener("load", function () {
          console.log('AI Webchat iframe loaded. Botpress config script should initialize and open the chat.');
          // If the config script doesn't auto-open and you need to force it with v2.5,
          // you might use:
          // if (window.botpressWebChat && typeof window.botpressWebChat.send === 'function') {
          //   window.botpressWebChat.send({ type: 'showWindow' }); // Example command for v2.x
          // }
        });
      </script>
    </body>
    </html>
  `, []);

  // This page component will directly render the HTML content for the iframe.
  // In a Next.js App Router page, we usually return JSX.
  // To serve raw HTML, we'd typically use an API route or set srcDoc on an iframe in another component.
  // Given the setup, this component is meant to BE the content of the iframe.
  // So, it should render an iframe if it were a parent, or just the HTML if it's the iframe's source.
  // For clarity, I will return an iframe here, but if this page.tsx is the direct source,
  // then just returning null and having this page served AS the iframe content is fine.
  // However, to be explicit as a React component for the /botpress-iframe route:
  return (
    <iframe
      srcDoc={botpressSrcDoc}
      title="Botpress Webchat Frame Content"
      className="w-full h-full border-0"
      allow="microphone" // If your bot uses microphone
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  );
};

export default BotpressIframePage;
