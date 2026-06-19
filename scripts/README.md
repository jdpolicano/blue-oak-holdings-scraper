# Scripts

Repository tooling lives under `scripts/`. The main entrypoint is the AWS operations CLI:

```bash
npm run aws:ops -- <command> [options]
```

The CLI is written in TypeScript and runs with `tsx`. It is intended for local and CI operational workflows around the existing AWS production stack:

- Build and push Docker images to ECR.
- Run one-off ECS dry-run tasks without changing the scheduled stack.
- Fetch CloudWatch logs for a completed ECS task.
- Delete test image tags and recent untagged ECR build artifacts.
- Deploy the scheduled CloudFormation stack when explicitly confirmed.

On success, the CLI writes one JSON object to stdout. Human progress output goes to stderr. When using `npm run`, npm itself may print its script banner unless the command is run with `npm --silent`.

## Commands

- [image build-push](docs/image-build-push.md)
- [image delete](docs/image-delete.md)
- [image cleanup-untagged](docs/image-cleanup-untagged.md)
- [deploy scheduled](docs/deploy-scheduled.md)
- [task run-dry-run](docs/task-run-dry-run.md)
- [task logs](docs/task-logs.md)

## Defaults

| Setting | Environment override | Default |
| --- | --- | --- |
| AWS region | `REGION`, `AWS_REGION` | `us-east-1` |
| CloudFormation stack | `STACK_NAME` | `blue-oak-holdings-scraper` |
| Scheduled rule logical id | `SCHEDULED_RULE_LOGICAL_ID` | `ScheduledScrape` |
| Docker platform | `DOCKER_PLATFORM` | `linux/amd64` |
| CloudFormation template | `CLOUDFORMATION_TEMPLATE` | `infra/fargate-task-chromium.yaml` |
| ECR repository URI | `ECR_REPOSITORY_URI` | derived from scheduled task image |
| ECR repository name | `ECR_REPOSITORY_NAME` | derived from scheduled task image |

## Common Dry-Run Flow

```bash
TAG=dry-run-single-site-thedynastyba-$(git rev-parse --short HEAD)-$(date +%Y%m%d-%H%M%S)

npm run aws:ops -- image build-push --tag "$TAG"
npm run aws:ops -- task run-dry-run --image-uri <imageUri> --site thedynastyba --wait
npm run aws:ops -- task logs --task-id <taskId> --tail 80
npm run aws:ops -- image delete --tag "$TAG"
npm run aws:ops -- image cleanup-untagged --since-minutes 15
```

Use the digest-based `imageUri` returned by `image build-push` for task runs and production deploys. The tagged URI is useful for humans; the digest URI is the immutable artifact reference.

## Safety Notes

- `task run-dry-run` always sets `DRY_RUN=true` and does not update the scheduled production stack.
- `deploy scheduled` updates production and requires `--confirm-production`.
- `image delete` refuses protected tags by default: `latest`, `prod`, `production`, `main`, and `stable`.
- `image delete` also refuses deleting a tag whose digest is currently used by the scheduled task unless `--force` is supplied.
- `image cleanup-untagged` deletes every untagged image in the resolved ECR repository pushed within the supplied time window. Use a narrow window after a known test build.

## Typechecking

`tsconfig.json` only includes application source under `src/`, so typecheck the CLI explicitly after changing scripts:

```bash
npx tsc --noEmit --target esnext --module nodenext --moduleResolution nodenext --strict --types node scripts/aws-ops.ts
```
