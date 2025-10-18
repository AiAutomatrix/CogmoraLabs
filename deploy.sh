#!/bin/bash
# Stop on any error
set -e

# Variables
PROJECT_ID="studio-2613744537-e60c7"
REGION="us-central1"
SERVICE_NAME="realtime-worker"
IMAGE="us-central1-docker.pkg.dev/$PROJECT_ID/docker-repo/$SERVICE_NAME:latest"
SOURCE_DIR="realtime-worker"
CLOUDBUILD_SERVICE_ACCOUNT="1084135620241@cloudbuild.gserviceaccount.com"

echo "🔐 Granting Artifact Registry Writer role to Cloud Build service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$CLOUDBUILD_SERVICE_ACCOUNT" \
  --role="roles/artifactregistry.writer" \
  --condition=None > /dev/null 2>&1 || echo "IAM policy for Artifact Registry Writer already exists or failed to update."


echo "🔨 Building Docker image using Cloud Build..."
gcloud builds submit --tag $IMAGE $SOURCE_DIR --project=$PROJECT_ID

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --project=$PROJECT_ID

echo "✅ Deployment complete!"
