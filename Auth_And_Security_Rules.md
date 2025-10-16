# Authentication & Security Rules Documentation

This document explains the architecture for user authentication and the Firestore Security Rules that protect user data in the Cogmora Labs application.

---

## 1. Authentication Flow

The application uses **Firebase Authentication** to manage user identities. This system is centered around the concept of a unique User ID (`uid`) for every user.

-   **Sign-In Methods**: Users can sign in via email/password or as a guest (anonymous sign-in).
-   **Unique Identifier (`uid`)**: Upon authentication, Firebase assigns a unique `uid` to the user. This `uid` is the cornerstone of our security model. It acts as the "key" that links a user to their specific data in the Firestore database.

---

## 2. Firestore Data Structure

All user-specific data is stored in a top-level collection called `users`. The structure is designed to be a "silo" for each user, using their `uid` as the primary document key.

Our data structure blueprint is defined in `docs/backend.json` and looks like this:

-   `/users/{userId}`
    -   This document stores the user's core profile information (email, display name, etc.). The `{userId}` is the user's actual `uid` from Firebase Authentication.
    -   **Subcollections**: All of the user's paper trading data is stored in subcollections *within* this document.
        -   `/users/{userId}/paperTradingContext/main`: A special document holding the main trading state like balance and automation settings.
        -   `/users/{userId}/paperTradingContext/main/openPositions/{positionId}`: A collection of the user's open trades.
        -   `/users/{userId}/paperTradingContext/main/watchlist/{symbol}`: A collection for their watchlist items.
        -   `/users/{userId}/paperTradingContext/main/tradeHistory/{tradeId}`: A log of all their past trades.
        -   ... and so on for triggers and alerts.

This structure ensures that all data related to a single user is neatly organized under their unique ID.

---

## 3. Firestore Security Rules

The security rules in `firestore.rules` are the "gatekeepers" that enforce data privacy and prevent one user from accessing another's data. Our current, working ruleset is simple, powerful, and secure.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Rule 1: Allow a user to create their own user profile document.
    match /users/{userId} {
      allow create: if request.auth.uid == userId;
    }

    // Rule 2: Allow a user to read and write to ANY document or subcollection
    // within their own user profile directory.
    match /users/{userId}/{path=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### How These Rules Work:

1.  **Rule 1 (Profile Creation)**:
    -   `match /users/{userId}` targets the main user document (e.g., `/users/USER_ABC`).
    -   `allow create: if request.auth.uid == userId;` states that a user is only allowed to **create** their profile document if their authenticated `uid` matches the document ID they are trying to create. This prevents users from creating profiles for others.

2.  **Rule 2 (Full Data Ownership)**:
    -   This is the most important rule for the paper trading engine.
    -   `match /users/{userId}/{path=**}` is a recursive wildcard. It matches the user's main document AND any document in any subcollection underneath it (e.g., a watchlist item, an open position, etc.).
    -   `allow read, write: if request.auth.uid == userId;` is the core security check. It allows a user to **read** or **write** to any of these documents *if and only if* their authenticated `uid` matches the `userId` in the path.

### Why It Works Now:

When you perform any action in the paper trading engine (saving settings, adding to the watchlist, closing a trade), the application sends a request to a path like `/users/YOUR_USER_ID/...`. The security rules check if the person making the request has the UID `YOUR_USER_ID`. Since you are logged in, the check passes. If another user tried to access that same path, their UID would not match, and Firestore would deny the request, ensuring your data remains private and secure.
