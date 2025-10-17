#!/bin/bash

# Stop on any error
set -e

# Variables
PROJECT_ID="studio-2613744537-e60c7"
REGION="us-central1"
SERVICE_NAME="realtime-worker"
IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/$SERVICE_NAME:latest"
SOURCE_DIR="realtime-worker"

echo "🔨 Building Docker image..."
gcloud builds submit --tag $IMAGE $SOURCE_DIR

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080

echo "✅ Deployment complete!"