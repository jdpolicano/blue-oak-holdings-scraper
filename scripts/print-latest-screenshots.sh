#!/usr/bin/env bash
set -euo pipefail

REGION="us-east-1"
BUCKET="blue-oak-holdings"
DIAGNOSTICS_PREFIX="${1:-diagnostics/}"
PRESIGN_EXPIRES_SECONDS=604800

LATEST_KEY="$(
  aws s3api list-objects-v2 \
    --region "$REGION" \
    --bucket "$BUCKET" \
    --prefix "$DIAGNOSTICS_PREFIX" \
    --query 'reverse(sort_by(Contents,&LastModified))[0].Key' \
    --output text
)"

if [[ -z "$LATEST_KEY" || "$LATEST_KEY" == "None" ]]; then
  echo "No screenshot objects found under s3://$BUCKET/$DIAGNOSTICS_PREFIX."
  exit 0
fi

RUN_PREFIX="$(awk -F/ '{ print $1 "/" $2 "/" $3 "/" $4 "/" }' <<< "$LATEST_KEY")"

echo "S3 run prefix: s3://$BUCKET/$RUN_PREFIX"
echo

KEYS="$(
  aws s3api list-objects-v2 \
    --region "$REGION" \
    --bucket "$BUCKET" \
    --prefix "$RUN_PREFIX" \
    --query 'sort_by(Contents,&Key)[].Key' \
    --output text |
    tr '\t' '\n' |
    awk 'NF && /\.png$/'
)"

if [[ -z "$KEYS" ]]; then
  echo "No screenshot PNGs found under s3://$BUCKET/$RUN_PREFIX."
  exit 0
fi

while IFS= read -r key; do
  site="$(awk -F/ '{ print $5 }' <<< "$key")"
  url="$(
    aws s3 presign "s3://$BUCKET/$key" \
      --region "$REGION" \
      --expires-in "$PRESIGN_EXPIRES_SECONDS"
  )"

  echo "$site"
  echo "$url"
  echo "S3 key: $key"
  echo
done <<< "$KEYS"
