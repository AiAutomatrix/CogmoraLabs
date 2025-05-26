'use client';

import React from 'react';

const AiWebchat: React.FC = () => {
  return (
    <div className="w-full h-full">
      <iframe
        src="/botpress-iframe"
        title="Botpress Webchat"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="clipboard-write; microphone"
      />
    </div>
  );
};

export default AiWebchat;
