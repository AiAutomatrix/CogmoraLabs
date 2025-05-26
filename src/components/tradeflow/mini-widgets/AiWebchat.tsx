'use client';

import React from 'react';

// This component now simply renders an iframe pointing to our dedicated Botpress page.
const AiWebchat: React.FC = () => {
  return (
    <iframe
      src="/botpress-iframe" // Points to the Next.js page at app/botpress-iframe/page.tsx
      title="AI Webchat"
      className="w-full h-full border-0"
      allow="microphone" // Add if your bot uses microphone input
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" // Standard sandbox permissions
    />
  );
};

export default AiWebchat;
