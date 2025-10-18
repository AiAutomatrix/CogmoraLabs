#!/bin/bash
# This script deploys all backend services for the Cogmora Labs application.
# It stops on any error to prevent partial deployments.
set -e

echo "🚀 Starting full backend deployment..."

# --- 1. Deploy Cloud Functions ---
echo "🔹 Deploying Cloud Functions (mainScheduler, closePositionHandler)..."
firebase deploy --only functions --project=studio-2613744537-e60c7

# --- 2. Deploy Firestore Rules ---
# Although indexes are managed manually, we still deploy rules.
echo "🔹 Deploying Firestore security rules..."
firebase deploy --only firestore:rules --project=studio-2613744537-e60c7

# --- 3. Deploy Real-time Worker to Cloud Run ---
# This reuses the existing deploy.sh logic for the worker.
echo "🔹 Deploying real-time worker to Cloud Run..."
./deploy.sh

echo "✅ Full backend deployment completed successfully!"
