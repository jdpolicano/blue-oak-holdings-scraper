# deploy scheduled

Deploys the scheduled production CloudFormation stack with a new scraper image.

```bash
npm run aws:ops -- deploy scheduled --image-uri <uri> --confirm-production
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--image-uri <uri>` | Yes | Digest-based or tagged ECR image URI for the scheduled task. |
| `--confirm-production` | Yes | Required confirmation because this updates production infrastructure. |

## Behavior

- Reads the CloudFormation template from `CLOUDFORMATION_TEMPLATE` or `infra/fargate-task-chromium.yaml`.
- Creates the stack if it does not exist.
- Updates the existing stack when it does exist.
- Sets the `ImageUri` parameter to the supplied value.
- Preserves existing stack parameters with `UsePreviousValue`.
- Polls CloudFormation until the stack reaches a terminal status.

## Output

The JSON output includes:

- `stack`
- `task`
- `rule`
- `cluster`
- `imageUri`

## Example

```bash
npm run aws:ops -- deploy scheduled --image-uri 137532962642.dkr.ecr.us-east-1.amazonaws.com/blue-oak-holdings/scraper@sha256:<digest> --confirm-production
```
