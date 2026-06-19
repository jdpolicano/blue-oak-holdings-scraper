# task run-dry-run

Runs a one-off ECS Fargate task directly, without changing the scheduled production stack.

```bash
npm run aws:ops -- task run-dry-run [--image-uri <uri>] [--site <site>] [--sites <csv>] [--wait]
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--image-uri <uri>` | No | Image to run. Defaults to the image currently used by the scheduled task. |
| `--site <site>` | No | Add one site to `SCRAPER_SITES`. Can be supplied more than once. |
| `--sites <csv>` | No | Comma-separated sites for `SCRAPER_SITES`. |
| `--wait` | No | Poll ECS until the task stops and include final container status. |

## Behavior

- Resolves the existing scheduled ECS target from EventBridge and CloudFormation.
- Always injects `DRY_RUN=true`.
- Sets `LOG_LEVEL` to the current environment value or `debug`.
- Maps `--site` and `--sites` to `SCRAPER_SITES`.
- If `--image-uri` differs from the scheduled image, registers a temporary task definition and deregisters it after the task starts or finishes.
- Uses explicit ECS polling when `--wait` is supplied.

## Output

The JSON output includes:

- `ruleName`
- `clusterArn`
- `sourceTaskDefinitionArn`
- `taskDefinitionArn`
- `temporaryTaskDefinitionArn`
- `taskArn`
- `containerName`
- `imageUri`
- `scraperSites`
- `finalStatus` when `--wait` is supplied

## Example

```bash
npm run aws:ops -- task run-dry-run --image-uri <imageUri> --site thedynastyba --wait
```
