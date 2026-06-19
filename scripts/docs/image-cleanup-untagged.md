# image cleanup-untagged

Deletes recent untagged ECR images from the resolved repository.

```bash
npm run aws:ops -- image cleanup-untagged --since-minutes <minutes>
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--since-minutes <minutes>` | Yes | Delete untagged images pushed after this cutoff. Must be greater than `0`. |

## Behavior

Docker buildx can leave untagged image records, such as platform images or attestations, after a build/push. This command lists untagged images in the resolved ECR repository and deletes those with `imagePushedAt` inside the requested time window.

Use a narrow window after a known test build, especially if other builds may be pushing to the same repository.

## Output

The JSON output includes:

- `repository`
- `sinceMinutes`
- `cutoff`
- `candidates`
- `deleted`
- `failures`

## Example

```bash
npm run aws:ops -- image cleanup-untagged --since-minutes 15
```
