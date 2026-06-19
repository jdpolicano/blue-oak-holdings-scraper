# image build-push

Builds the repository Docker image from the repo root and pushes it to ECR.

```bash
npm run aws:ops -- image build-push [--tag <tag>]
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--tag <tag>` | No | ECR tag to apply. Defaults to `latest`. |

## Behavior

- Resolves the target ECR repository from `ECR_REPOSITORY_URI`, `ECR_REPOSITORY_NAME`, or the image used by the scheduled production task.
- Logs in to ECR with AWS SDK credentials.
- Runs `docker buildx build --platform <platform> --tag <repo>:<tag> --push .`.
- Emits both the tag URI and digest-based `imageUri`.

## Output

The JSON output includes:

- `repository.repositoryName`
- `repository.repositoryUri`
- `tag`
- `tagUri`
- `imageUri`
- `digest`
- `pushedAt`
- `git`

Use `imageUri` for `task run-dry-run` and `deploy scheduled`.

## Example

```bash
TAG=dry-run-single-site-thedynastyba-$(git rev-parse --short HEAD)
npm run aws:ops -- image build-push --tag "$TAG"
```
