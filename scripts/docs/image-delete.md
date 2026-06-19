# image delete

Deletes a tagged image from ECR.

```bash
npm run aws:ops -- image delete --tag <tag> [--force]
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--tag <tag>` | Yes | ECR tag to delete. |
| `--force` | No | Bypass protected-tag and scheduled-image checks. |

## Safety Checks

By default, the command refuses to delete these protected tags:

- `latest`
- `prod`
- `production`
- `main`
- `stable`

It also refuses to delete a tag when the tag or its digest is currently used by the scheduled production task.

## Output

The JSON output includes:

- `repository`
- `tag`
- `deleted`
- `failures`

## Example

```bash
npm run aws:ops -- image delete --tag dry-run-single-site-thedynastyba-a1b2c3d
```
