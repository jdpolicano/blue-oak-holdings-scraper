import {
  CreateStackCommand,
  DescribeStackResourceCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
  type Capability,
  type Parameter,
  type Stack,
} from "@aws-sdk/client-cloudformation";
import { readFile } from "node:fs/promises";
import { describeStack, resolveScheduledTarget, type AwsClients } from "./aws.js";
import { requireValue, type AwsOpsConfig } from "./config.js";
import { logProgress } from "./process.js";

export interface DeployScheduledResult {
  stack: {
    stackName: string;
    stackId?: string;
    stackStatus?: string;
    outputs?: Record<string, string>;
  };
  task: {
    taskDefinitionArn: string;
    imageUri: string;
    containerName: string;
  };
  rule: {
    logicalId: string;
    name: string;
  };
  cluster: {
    arn: string;
  };
}

export async function deployScheduledStack(params: {
  clients: AwsClients;
  config: AwsOpsConfig;
  imageUri: string;
}): Promise<DeployScheduledResult> {
  const templateBody = await readFile(params.config.templatePath, "utf-8");
  const existingStack = await describeStack(
    params.clients,
    params.config.stackName,
  );
  const stackParams = {
    StackName: params.config.stackName,
    TemplateBody: templateBody,
    Parameters: getStackParameters(existingStack, params.imageUri),
    Capabilities: ["CAPABILITY_NAMED_IAM" as Capability],
  };

  if (existingStack) {
    logProgress(`Updating CloudFormation stack ${params.config.stackName}`);
    try {
      await params.clients.cloudFormation.send(
        new UpdateStackCommand(stackParams),
      );
    } catch (error) {
      if (!isNoUpdatesError(error)) throw error;
      logProgress("CloudFormation reported no updates");
    }
  } else {
    logProgress(`Creating CloudFormation stack ${params.config.stackName}`);
    await params.clients.cloudFormation.send(new CreateStackCommand(stackParams));
  }

  const stack = await pollStackComplete(params.clients, params.config.stackName);
  const scheduledTarget = await resolveScheduledTarget(
    params.clients,
    params.config,
  );
  const ruleName = await resolveRuleName(params.clients, params.config);

  return {
    stack: {
      stackName: params.config.stackName,
      stackId: stack.StackId,
      stackStatus: stack.StackStatus,
      outputs: Object.fromEntries(
        stack.Outputs?.map((output) => [
          requireValue(output.OutputKey, "Stack output is missing a key"),
          output.OutputValue ?? "",
        ]) ?? [],
      ),
    },
    task: {
      taskDefinitionArn: scheduledTarget.taskDefinitionArn,
      imageUri: scheduledTarget.containerImage,
      containerName: scheduledTarget.containerName,
    },
    rule: {
      logicalId: params.config.scheduledRuleLogicalId,
      name: ruleName,
    },
    cluster: {
      arn: scheduledTarget.clusterArn,
    },
  };
}

async function pollStackComplete(
  clients: AwsClients,
  stackName: string,
): Promise<Stack> {
  const startedAt = Date.now();
  const maxWaitMs = Number(
    process.env.CLOUDFORMATION_MAX_WAIT_MS ?? 60 * 60 * 1000,
  );
  const intervalMs = Number(
    process.env.CLOUDFORMATION_POLL_INTERVAL_MS ?? 15 * 1000,
  );

  while (Date.now() - startedAt < maxWaitMs) {
    const result = await clients.cloudFormation.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    const stack = requireValue(
      result.Stacks?.[0],
      `CloudFormation stack ${stackName} was not found`,
    );
    const status = stack.StackStatus ?? "UNKNOWN";
    logProgress(`Stack status: ${status}`);

    if (isCompleteStatus(status)) return stack;
    if (isFailureStatus(status)) {
      throw new Error(`CloudFormation stack ${stackName} failed with ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for CloudFormation stack ${stackName}`);
}

async function resolveRuleName(
  clients: AwsClients,
  config: AwsOpsConfig,
): Promise<string> {
  const stackResource = await clients.cloudFormation.send(
    new DescribeStackResourceCommand({
      StackName: config.stackName,
      LogicalResourceId: config.scheduledRuleLogicalId,
    }),
  );
  return requireValue(
    stackResource.StackResourceDetail?.PhysicalResourceId,
    `CloudFormation stack ${config.stackName} does not include ${config.scheduledRuleLogicalId}`,
  );
}

function isNoUpdatesError(error: unknown): boolean {
  return String(error).includes("No updates are to be performed");
}

function getStackParameters(
  existingStack: Stack | undefined,
  imageUri: string,
): Parameter[] {
  if (!existingStack) {
    return [{ ParameterKey: "ImageUri", ParameterValue: imageUri }];
  }

  const parameters =
    existingStack.Parameters?.map((parameter) => {
      if (parameter.ParameterKey === "ImageUri") {
        return { ParameterKey: "ImageUri", ParameterValue: imageUri };
      }
      return {
        ParameterKey: parameter.ParameterKey,
        UsePreviousValue: true,
      };
    }) ?? [];

  if (!parameters.some((parameter) => parameter.ParameterKey === "ImageUri")) {
    parameters.push({ ParameterKey: "ImageUri", ParameterValue: imageUri });
  }

  return parameters;
}

function isCompleteStatus(status: string): boolean {
  return (
    status === "CREATE_COMPLETE" ||
    status === "UPDATE_COMPLETE" ||
    status === "UPDATE_ROLLBACK_COMPLETE"
  );
}

function isFailureStatus(status: string): boolean {
  return (
    status.endsWith("_FAILED") ||
    status === "ROLLBACK_COMPLETE" ||
    status === "UPDATE_ROLLBACK_FAILED"
  );
}
