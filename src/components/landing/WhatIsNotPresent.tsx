'use client';

import React from 'react';

const sectionContent = [
  "I did not see clear pricing / subscription information on the homepage (at least from the public view).",
  "I did not immediately spot a “About Us / Our Team / Company / Contact” section (though it might be deeper).",
  "I did not find evidence of actual trading with real money (i.e. live exchanges, withdrawing funds) — everything is presented in “paper trading” mode.",
  "No visible whitepaper, nor deep technical architecture (at least not from the publicly visible homepage).",
  "No obvious regulatory disclaimers (or not prominent) about risks, compliance, etc.",
  "No insight into how the AI Chat module works (what model, training, etc.), or whether it's open or closed."
];

const WhatIsNotPresent = () => (
  <section className="py-20 px-4">
    <div className="container mx-auto text-left">
      <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">What is <em className="text-primary">not</em> (or not obviously) present</h2>
      <div className="max-w-3xl mx-auto">
        <ul className="list-disc list-inside space-y-3 text-muted-foreground">
          {sectionContent.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default WhatIsNotPresent;
