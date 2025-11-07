# Monetization Plan: Cogmora Labs

This document outlines the monetization strategy for the Cogmora Labs application. The goal is to establish a sustainable business model by offering premium features and services on top of a robust free tier.

---

## 1. Core Strategy: Freemium Model

We will adopt a freemium model to attract a wide user base with our core features, while offering paid upgrades for power users and those seeking convenience or advanced capabilities.

### a. The Free Tier (Acquisition & Engagement)
The free tier will be generous and fully-featured to showcase the platform's power and get users engaged.

-   **Virtual Balance**: Users start with a $100,000 paper trading account.
-   **Core Trading Features**: Full, unrestricted access to the manual paper trading engine (spot and futures), all charting tools, and all market screeners.
-   **AI Agent Credits**: New users receive a **one-time, free allotment of 30 AI Agent credits**. This is enough to thoroughly test the AI agent's capabilities and see its value. Each analysis run ("Run AI Now") will consume one credit.

### b. Paid Features (Monetization)
Monetization will focus on à la carte purchases, providing clear value without forcing users into a monthly subscription initially.

1.  **AI Agent Credit Packs**:
    -   **What it is**: Once a user depletes their initial 30 free credits, they can purchase more.
    -   **Offering**: The primary offering will be a "Pack of 100 AI Credits" for a set price.
    -   **Mechanism**: The "Run AI Now" button will be disabled when credits are at zero, prompting the user to purchase more.

2.  **Account Reset & Top-Up**:
    -   **What it is**: A convenience feature for users who have significantly depleted their paper trading balance and wish to start fresh.
    -   **Mechanism**: If a user's account equity drops below a certain threshold (e.g., $5,000), a button will appear in the dashboard offering a paid "Account Reset".
    -   **Action**: Upon successful payment, the service will:
        1.  Reset the user's `balance` in Firestore to $100,000.
        2.  **Delete all documents** from the user's `tradeHistory` subcollection, giving them a clean slate.
        3.  (Optional) Close all open positions.

---

## 2. Technical Implementation Plan

We will use **Stripe** for all payment processing due to its robust features, security, and developer-friendly APIs.

### a. Step 1: Backend (Cloud Functions)
-   **`createCheckoutSession` Function**:
    -   A new HTTP-triggered Cloud Function will be created.
    -   The frontend will call this function, specifying the product the user wants to buy (e.g., `'AI_CREDIT_PACK_100'` or `'ACCOUNT_RESET'`).
    -   The function will use the Stripe Node.js library to create a new **Stripe Checkout Session**.
    -   It will return the `sessionId` or the full `checkoutUrl` to the client.

### b. Step 2: Stripe Integration
-   **Stripe Checkout**: The client will redirect the user to the secure Stripe Checkout page to complete their payment. This offloads all PCI compliance and sensitive payment data handling to Stripe.

### c. Step 3: Fulfillment via Webhooks
-   **`stripeWebhook` Function**:
    -   We will create a second HTTP-triggered Cloud Function to act as a webhook endpoint for Stripe.
    -   Stripe will be configured to send an event (e.g., `checkout.session.completed`) to this endpoint upon successful payment.
    -   This function will securely verify the request is from Stripe using a signing secret.
    -   **Crucially**, upon verification, it will perform the fulfillment action by writing to Firestore:
        -   For AI credits, it will atomically increment the `ai_credits` field in the user's `/paperTradingContext/main` document.
        -   For an account reset, it will update the `balance` to 100000 and initiate the deletion of the user's `tradeHistory` subcollection.

### d. Step 4: Frontend UI
-   **Billing/Store UI**: A new modal or page will be created where users can view and select products to purchase.
-   **Credit Display**: The UI will be updated to display the user's current AI credit balance (e.g., in the header or user menu).
-   **Conditional Buttons**: The "Run AI Now" button will be disabled and change its text to "Buy Credits" when the user's credit count is zero. The "Account Reset" button will only appear when the user's balance is low.

This plan provides a clear path to integrating a secure and scalable monetization system into the application.
