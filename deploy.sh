#!/bin/bash
# This script deploys the real-time worker service to Cloud Run.
# It stops on any error.
set -e

# Variables
PROJECT_ID="studio-2613744537-e60c7"
REGION="us-central1"
SERVICE_NAME="realtime-worker"
IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/$SERVICE_NAME:latest"
SOURCE_DIR="realtime-worker"

echo "🔨 Building Docker image for the real-time worker..."
# Submit the build job to Cloud Build, pointing to the worker's source directory
gcloud builds submit $SOURCE_DIR --tag $IMAGE --project=$PROJECT_ID

echo "🚀 Deploying worker to Cloud Run..."
# Deploy the newly built image to the Cloud Run service
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances=1 \
  --project=$PROJECT_ID

echo "✅ Real-time worker deployment complete!"
