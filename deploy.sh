#!/bin/bash
# Stop on any error
set -e

# Variables
PROJECT_ID="studio-2613744537"
REGION="us-central1"
SERVICE_NAME="realtime-worker"
DOCKER_REPO="docker-repo"
IMAGE_TAG="latest"
IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/$DOCKER_REPO/$SERVICE_NAME:$IMAGE_TAG"
SOURCE_DIR="realtime-worker"

echo "🔐 Configuring Docker to authenticate with Google Artifact Registry..."
gcloud auth configure-docker $REGION-docker.pkg.dev

echo "🔨 Building Docker image locally..."
docker build -t $IMAGE_NAME $SOURCE_DIR

echo "📤 Pushing Docker image to Artifact Registry..."
docker push $IMAGE_NAME

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080

echo "✅ Deployment complete!"
