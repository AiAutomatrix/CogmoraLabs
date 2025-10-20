#!/bin/bash
# This script deploys all backend services for the Cogmora Labs application.
# It stops on any error to prevent partial deployments.
set -e

echo "🚀 Starting full backend deployment..."

# --- 1. Deploy Cloud Functions & Firestore Rules ---
# This command deploys both functions and firestore rules defined in firebase.json
echo "🔹 Deploying Cloud Functions and Firestore Rules..."
firebase deploy --only functions,firestore --project=studio-2613744537-e60c7

# --- 2. Deploy Real-time Worker to Cloud Run ---
# This reuses the existing deploy.sh logic for the worker.
echo "🔹 Deploying real-time worker to Cloud Run..."
./deploy.sh

echo "✅ Full backend deployment completed successfully!"
