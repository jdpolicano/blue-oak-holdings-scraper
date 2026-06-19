# task logs

Fetches CloudWatch log events for an ECS task run.

```bash
npm run aws:ops -- task logs (--task-arn <arn> | --task-id <id>) [--tail <n>] [--log-group <name>]
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--task-arn <arn>` | Yes, unless `--task-id` is used | ECS task ARN. |
| `--task-id <id>` | Yes, unless `--task-arn` is used | Final task id segment. |
| `--tail <n>` | No | Number of final events to return. Defaults to `200`. |
| `--log-group <name>` | No | Override the log group. Defaults to the scheduled task container log configuration. |

## Behavior

- Resolves the log stream from the scheduled task container log configuration.
- Uses the stream pattern `<awslogs-stream-prefix>/<container-name>/<task-id>`.
- Returns the final `--tail` events from the stream.
- Preserves raw log messages, including structured JSON messages from the scraper.

## Output

The JSON output includes:

- `logGroupName`
- `logStreamName`
- `taskId`
- `events`

## Example

```bash
npm run aws:ops -- task logs --task-id 21e43a4bc1284201bd3fe86c7cd4f4c5 --tail 80
```
