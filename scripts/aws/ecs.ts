import {
  DeregisterTaskDefinitionCommand,
  DescribeTasksCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  type ContainerDefinition,
  type RegisterTaskDefinitionCommandInput,
  type Task,
  type TaskDefinition,
} from "@aws-sdk/client-ecs";
import { setTimeout as sleep } from "node:timers/promises";
import { requireValue } from "./config.js";
import type { AwsClients, ScheduledTarget } from "./aws.js";
import { logProgress } from "./process.js";

export interface RunDryRunTaskResult {
  ruleName: string;
  clusterArn: string;
  sourceTaskDefinitionArn: string;
  taskDefinitionArn: string;
  temporaryTaskDefinitionArn?: string;
  taskArn: string;
  containerName: string;
  imageUri: string;
  scraperSites?: string;
  task?: Task;
  finalStatus?: {
    lastStatus?: string;
    stopCode?: string;
    stoppedReason?: string;
    containers?: Array<{
      name?: string;
      lastStatus?: string;
      exitCode?: number;
      reason?: string;
    }>;
  };
}

export async function runDryRunTask(params: {
  clients: AwsClients;
  scheduledTarget: ScheduledTarget;
  imageUri?: string;
  scraperSites?: string;
  wait: boolean;
}): Promise<RunDryRunTaskResult> {
  let temporaryTaskDefinitionArn: string | undefined;
  let taskDefinitionToRun = params.scheduledTarget.taskDefinitionArn;
  const imageUri =
    params.imageUri ?? params.scheduledTarget.containerImage;

  try {
    if (params.imageUri && params.imageUri !== params.scheduledTarget.containerImage) {
      const registerResult = await params.clients.ecs.send(
        new RegisterTaskDefinitionCommand(
          createRegisterTaskDefinitionInput(
            params.scheduledTarget.taskDefinition,
            params.scheduledTarget.containerName,
            params.imageUri,
          ),
        ),
      );
      temporaryTaskDefinitionArn = requireValue(
        registerResult.taskDefinition?.taskDefinitionArn,
        "AWS register-task-definition response did not include a task definition ARN",
      );
      taskDefinitionToRun = temporaryTaskDefinitionArn;
      logProgress(`Registered temporary task definition ${taskDefinitionToRun}`);
    }

    const environment = [
      { name: "DRY_RUN", value: "true" },
      { name: "LOG_LEVEL", value: process.env.LOG_LEVEL ?? "debug" },
    ];
    if (params.scraperSites) {
      environment.push({ name: "SCRAPER_SITES", value: params.scraperSites });
    }

    const runTaskResult = await params.clients.ecs.send(
      new RunTaskCommand({
        cluster: params.scheduledTarget.clusterArn,
        launchType: "FARGATE",
        taskDefinition: taskDefinitionToRun,
        networkConfiguration: {
          awsvpcConfiguration: params.scheduledTarget.networkConfiguration,
        },
        overrides: {
          containerOverrides: [
            {
              name: params.scheduledTarget.containerName,
              environment,
            },
          ],
        },
      }),
    );

    if (runTaskResult.failures?.length) {
      throw new Error(
        `ECS RunTask failed: ${JSON.stringify(runTaskResult.failures)}`,
      );
    }

    const taskArn = requireValue(
      runTaskResult.tasks?.[0]?.taskArn,
      "AWS run-task response did not include a task ARN",
    );
    logProgress(`Started task ${taskArn}`);

    const result: RunDryRunTaskResult = {
      ruleName: params.scheduledTarget.ruleName,
      clusterArn: params.scheduledTarget.clusterArn,
      sourceTaskDefinitionArn: params.scheduledTarget.taskDefinitionArn,
      taskDefinitionArn: taskDefinitionToRun,
      temporaryTaskDefinitionArn,
      taskArn,
      containerName: params.scheduledTarget.containerName,
      imageUri,
      scraperSites: params.scraperSites || undefined,
    };

    if (params.wait) {
      const task = await pollTaskStopped(
        params.clients,
        params.scheduledTarget.clusterArn,
        taskArn,
      );
      result.task = task;
      result.finalStatus = {
        lastStatus: task.lastStatus,
        stopCode: task.stopCode,
        stoppedReason: task.stoppedReason,
        containers: task.containers?.map((container) => ({
          name: container.name,
          lastStatus: container.lastStatus,
          exitCode: container.exitCode,
          reason: container.reason,
        })),
      };
    }

    return result;
  } finally {
    if (temporaryTaskDefinitionArn) {
      try {
        await params.clients.ecs.send(
          new DeregisterTaskDefinitionCommand({
            taskDefinition: temporaryTaskDefinitionArn,
          }),
        );
        logProgress(
          `Deregistered temporary task definition ${temporaryTaskDefinitionArn}`,
        );
      } catch (error) {
        logProgress(
          `Failed to deregister temporary task definition ${temporaryTaskDefinitionArn}: ${String(error)}`,
        );
      }
    }
  }
}

function createRegisterTaskDefinitionInput(
  taskDefinition: TaskDefinition,
  containerName: string,
  nextImageUri: string,
): RegisterTaskDefinitionCommandInput {
  const family = requireValue(
    taskDefinition.family,
    "Task definition does not include a family",
  );
  const containerDefinitions = requireValue(
    taskDefinition.containerDefinitions,
    "Task definition does not include container definitions",
  ).map((container) =>
    container.name === containerName
      ? { ...container, image: nextImageUri }
      : { ...container },
  );

  assertContainerExists(containerDefinitions, containerName);

  return removeEmptyValues({
    family: `${family}-dry-run`,
    taskRoleArn: taskDefinition.taskRoleArn,
    executionRoleArn: taskDefinition.executionRoleArn,
    networkMode: taskDefinition.networkMode,
    containerDefinitions,
    volumes: taskDefinition.volumes,
    placementConstraints: taskDefinition.placementConstraints,
    requiresCompatibilities: taskDefinition.requiresCompatibilities,
    cpu: taskDefinition.cpu,
    memory: taskDefinition.memory,
    pidMode: taskDefinition.pidMode,
    ipcMode: taskDefinition.ipcMode,
    proxyConfiguration: taskDefinition.proxyConfiguration,
    inferenceAccelerators: taskDefinition.inferenceAccelerators,
    ephemeralStorage: taskDefinition.ephemeralStorage,
    runtimePlatform: taskDefinition.runtimePlatform,
  });
}

function assertContainerExists(
  containerDefinitions: ContainerDefinition[],
  containerName: string,
): void {
  const matched = containerDefinitions.some(
    (container) => container.name === containerName,
  );
  if (!matched) {
    throw new Error(`Container ${containerName} not found in task definition`);
  }
}

function removeEmptyValues(
  input: RegisterTaskDefinitionCommandInput,
): RegisterTaskDefinitionCommandInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value) && !value.length) return false;
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) {
        return false;
      }
      return true;
    }),
  ) as RegisterTaskDefinitionCommandInput;
}

async function pollTaskStopped(
  clients: AwsClients,
  clusterArn: string,
  taskArn: string,
): Promise<Task> {
  const startedAt = Date.now();
  const maxWaitMs = Number(process.env.ECS_TASK_MAX_WAIT_MS ?? 60 * 60 * 1000);
  const intervalMs = Number(process.env.ECS_TASK_POLL_INTERVAL_MS ?? 15 * 1000);

  while (Date.now() - startedAt < maxWaitMs) {
    const result = await clients.ecs.send(
      new DescribeTasksCommand({ cluster: clusterArn, tasks: [taskArn] }),
    );
    const task = result.tasks?.[0];
    if (task?.lastStatus === "STOPPED") {
      return task;
    }
    logProgress(`Task status: ${task?.lastStatus ?? "UNKNOWN"}`);
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ECS task ${taskArn} to stop`);
}
