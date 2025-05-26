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
    const existingScript = document.querySelector('script[src="https://cdn.botpress.cloud/webchat/v1/inject.js"]');
    if (existingScript) {
      if (window.botpressWebChat?.open) {
        window.botpressWebChat.open();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.botpress.cloud/webchat/v1/inject.js';
    script.async = true;
    script.onload = () => {
      if (window.botpressWebChat?.open) {
        window.botpressWebChat.open();
      } else {
        window.botpressWebChat?.onEvent?.(() => {
          window.botpressWebChat?.open?.();
        }, ['LIFECYCLE.LOADED']);
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
      const container = document.getElementById('botpress-webchat-container');
      if (container?.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

  return <div id="botpress-webchat-container" className="w-full h-full" />;
};

export default BotpressIframePage;
