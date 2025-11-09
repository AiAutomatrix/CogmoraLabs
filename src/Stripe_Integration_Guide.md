# Stripe Integration Guide (via Firebase Extension)

This guide outlines the steps to set up and test the Stripe payment system within the Cogmora Labs application using the official Firebase "Run Payments with Stripe" extension.

---

## 1. How It Works

We are using a robust, serverless architecture where our client application does not need to call a custom API. Instead, the entire payment flow is orchestrated through Firestore.

1.  **Client-Side (Our App)**: When a user clicks "Purchase," the `BillingPopup.tsx` component writes a new document to a specific collection in Firestore: `/users/{userId}/checkout_sessions`. This document contains the `priceId` of the product.
2.  **Firebase Extension (Backend)**: The "Run Payments with Stripe" extension automatically listens for new documents in this collection.
3.  **Stripe API Call**: When it detects a new document, the extension's Cloud Function securely calls the Stripe API to create a checkout session.
4.  **Firestore Update**: The extension then writes the resulting `url` or `sessionId` back to the Firestore document it was just processing.
5.  **Client-Side Redirect**: Our `BillingPopup.tsx` is simultaneously listening to that same document. When it sees the `url` or `sessionId` appear, it uses Stripe.js to redirect the user to the secure Stripe checkout page.
6.  **Fulfillment**: After a successful payment, a Stripe webhook notifies the Firebase extension, which then securely updates the user's data in Firestore (e.g., increments their `ai_credits`).

This is a secure, scalable, and maintainable approach that keeps all our logic within the Firebase ecosystem.

---

## 2. Your Action Required: Install the Firebase Extension

I have already written all the necessary client-side code. The only step you need to perform is to install the extension in your Firebase project.

**Step-by-Step Installation:**

1.  **Go to your Firebase Project Console.**
2.  Navigate to the **Build** section in the left-hand menu and select **Extensions**.
3.  Click the **"Explore Extensions"** button.
4.  Search for **"Run Payments with Stripe"** and select the official extension (it will be published by Stripe).
5.  Click **"Install in project"**.
6.  The installation wizard will guide you through several configuration steps. The most important ones are:
    *   **Billing**: You will need to be on the "Blaze" (Pay-as-you-go) plan for your Firebase project to use extensions.
    *   **API Keys**: The installer will ask for your Stripe API keys. Make sure you use your **Test Mode** keys for now (`sk_test_...` and `pk_test_...`).
    *   **Cloud Functions Location**: Select `us-central1` or your preferred region.
    *   **Firestore Collections**: The wizard will ask for the names of the collections it should use. **Use the default names** (`customers`, `products`, `checkout_sessions`). My code is written to use these defaults.
7.  **Complete the installation.** It may take a few minutes for the extension to be fully installed and for its Cloud Functions to be deployed.

---

## 3. Testing the Integration

Once the extension is installed:

1.  **Create a Product in Stripe**:
    *   Go to your **Stripe Dashboard** (in Test Mode).
    *   Navigate to the **Products** tab.
    *   Create a new product named "AI Credit Pack" or similar.
    *   Set its price to $5.00 (or any amount) and make sure it's a **one-time** payment.
    *   After saving, copy the **Price ID** (it will look like `price_...`). The Price ID `price_1SREGsR1GTVMlhwAIHGT4Ofd` is currently hardcoded in `BillingPopup.tsx`. Ensure your product uses this ID, or update the component.

2.  **Run the App**:
    *   Launch the Cogmora Labs application.
    *   Open the billing popup from the user menu.
    *   Click the "Purchase" button.

If everything is configured correctly, you should be redirected to the Stripe checkout page to complete the test purchase. After a successful "payment," the webhook from Stripe will trigger the extension to fulfill the order (though we may need to write the fulfillment logic for adding credits later).
