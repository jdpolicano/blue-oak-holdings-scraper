# scrapy-brokers-poc
A top secret project for BOH.

# TODO
1. Make the application configurable via a config file instead of these weird env vars (S3_BUCKET_NAME, S3_OBJECT_KEY, SES_FROM_ADDRESSSES_TO_ADDRESSES).
2. implement some kind of retry mechanism in event bridge. We saw a weird issue on Oct 23rd where it failed to pull the ECR image for seemingly no reason. After running the task manually shortly after, it worked fine however.
3. Investigate why dynastyba always fails on the first attempt for several pages. It always works the second time, but it would be preferable to at least understand why.
4. build in notifications on failures. The program should ideally collect a list of url's it fail for and report those to the admin (me). This way I don't have to worry about checking in on it every day and instead can just make sure to check my email semi-frequently.
5. Need to expand the schema to start including more id info like listing # if available. Right now it looks like the href is the only unique identifier we have for each listing, but that may not always be the case and it is already breaking down in some cases.
