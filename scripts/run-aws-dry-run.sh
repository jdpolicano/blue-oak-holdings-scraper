#!/usr/bin/env bash
set -euo pipefail

REGION="us-east-1"
CLUSTER="blue-oak-holdings-scrape-cluster"
TASK_DEFINITION="blue-oak-holdings-scrape-task"
CONTAINER_NAME="blue-oak-holdings-scraper"
SECURITY_GROUP="sg-03d066ccd198d13d8"

SUBNETS=(
  "subnet-037b322b9edb1b49d"
  "subnet-0fcd90afeaecc8fc2"
  "subnet-082e0eef14ebe3a69"
  "subnet-0e7d8f75d8348937c"
  "subnet-0c7d45e4526c85204"
  "subnet-0a7b232b7e08a0600"
)

SUBNET_LIST="$(IFS=,; echo "${SUBNETS[*]}")"

aws ecs run-task \
  --region "$REGION" \
  --cluster "$CLUSTER" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEFINITION" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --overrides "{
    \"containerOverrides\": [
      {
        \"name\": \"$CONTAINER_NAME\",
        \"environment\": [
          { \"name\": \"DRY_RUN\", \"value\": \"true\" },
          { \"name\": \"LOG_LEVEL\", \"value\": \"debug\" }
        ]
      }
    ]
  }"
