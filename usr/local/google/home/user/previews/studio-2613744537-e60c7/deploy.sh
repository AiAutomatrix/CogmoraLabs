#!/bin/bash
# Stop on any error
set -e

# Variables
PROJECT_ID="studio-2613744537"
REGION="us-central1"
SERVICE_NAME="realtime-worker"
IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/$SERVICE_NAME:latest"
SOURCE_DIR="realtime-worker"
CLOUDBUILD_SA="1084135620241@cloudbuild.gserviceaccount.com"
FULL_PROJECT_ID="studio-2613744537-e60c7"

echo "🔑 Ensuring Cloud Build service account has Artifact Registry permissions..."
gcloud projects add-iam-policy-binding $FULL_PROJECT_ID \
  --member="serviceAccount:$CLOUDBUILD_SA" \
  --role="roles/artifactregistry.writer"

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
