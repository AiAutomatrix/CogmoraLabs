'use client';

import React from 'react';

// This component now simply renders an iframe pointing to the Botpress page.
const AiWebchat: React.FC = () => {
  return (
    <div className="w-full h-full">
      <iframe
        src="/botpress-iframe"
        title="Botpress Webchat"
        className="w-full h-full border-0"
        allow="microphone" // Optional: if your bot uses microphone
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
};

export default AiWebchat;