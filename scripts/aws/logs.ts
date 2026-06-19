import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
  type OutputLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";
import type { ScheduledTarget } from "./aws.js";
import { requireValue } from "./config.js";

export interface TaskLogsResult {
  logGroupName: string;
  logStreamName: string;
  taskId: string;
  events: Array<{
    timestamp?: string;
    ingestionTime?: string;
    message?: string;
  }>;
}

export async function getTaskLogs(params: {
  client: CloudWatchLogsClient;
  scheduledTarget: ScheduledTarget;
  taskArnOrId: string;
  logGroupName?: string;
  tail: number;
}): Promise<TaskLogsResult> {
  const taskId = parseTaskId(params.taskArnOrId);
  const logConfiguration = requireValue(
    params.scheduledTarget.taskDefinition.containerDefinitions?.find(
      (container) => container.name === params.scheduledTarget.containerName,
    )?.logConfiguration,
    `Container ${params.scheduledTarget.containerName} does not include log configuration`,
  );
  const options = logConfiguration.options ?? {};
  const logGroupName =
    params.logGroupName ??
    requireValue(
      options["awslogs-group"],
      `Container ${params.scheduledTarget.containerName} log configuration does not include awslogs-group`,
    );
  const streamPrefix = requireValue(
    options["awslogs-stream-prefix"],
    `Container ${params.scheduledTarget.containerName} log configuration does not include awslogs-stream-prefix`,
  );
  const logStreamName = `${streamPrefix}/${params.scheduledTarget.containerName}/${taskId}`;
  const events = await getAllEvents({
    client: params.client,
    logGroupName,
    logStreamName,
  });

  return {
    logGroupName,
    logStreamName,
    taskId,
    events: events.slice(-params.tail).map((event) => ({
      timestamp: event.timestamp
        ? new Date(event.timestamp).toISOString()
        : undefined,
      ingestionTime: event.ingestionTime
        ? new Date(event.ingestionTime).toISOString()
        : undefined,
      message: event.message,
    })),
  };
}

function parseTaskId(taskArnOrId: string): string {
  const parts = taskArnOrId.split("/");
  return parts[parts.length - 1] || taskArnOrId;
}

async function getAllEvents(params: {
  client: CloudWatchLogsClient;
  logGroupName: string;
  logStreamName: string;
}): Promise<OutputLogEvent[]> {
  const events: OutputLogEvent[] = [];
  let nextToken: string | undefined;
  let previousToken: string | undefined;

  do {
    const result = await params.client.send(
      new GetLogEventsCommand({
        logGroupName: params.logGroupName,
        logStreamName: params.logStreamName,
        nextToken,
        startFromHead: true,
      }),
    );
    events.push(...(result.events ?? []));
    previousToken = nextToken;
    nextToken = result.nextForwardToken;
  } while (nextToken && nextToken !== previousToken);

  return events;
}
