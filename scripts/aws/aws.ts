import {
  CloudFormationClient,
  DescribeStackResourceCommand,
  DescribeStacksCommand,
  type Stack,
} from "@aws-sdk/client-cloudformation";
import {
  DescribeTaskDefinitionCommand,
  ECSClient,
  type AwsVpcConfiguration as EcsAwsVpcConfiguration,
  type TaskDefinition,
} from "@aws-sdk/client-ecs";
import {
  EventBridgeClient,
  ListTargetsByRuleCommand,
  type AwsVpcConfiguration as EventBridgeAwsVpcConfiguration,
  type Target,
} from "@aws-sdk/client-eventbridge";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { requireValue, type AwsOpsConfig } from "./config.js";

export interface AwsClients {
  cloudFormation: CloudFormationClient;
  ecs: ECSClient;
  eventBridge: EventBridgeClient;
  sts: STSClient;
}

export interface ScheduledTarget {
  ruleName: string;
  target: Target;
  clusterArn: string;
  taskDefinitionArn: string;
  taskDefinition: TaskDefinition;
  containerName: string;
  containerImage: string;
  networkConfiguration: EcsAwsVpcConfiguration;
}

export function createAwsClients(config: AwsOpsConfig): AwsClients {
  return {
    cloudFormation: new CloudFormationClient({ region: config.region }),
    ecs: new ECSClient({ region: config.region }),
    eventBridge: new EventBridgeClient({ region: config.region }),
    sts: new STSClient({ region: config.region }),
  };
}

export async function getCallerAccountId(
  clients: AwsClients,
): Promise<string | undefined> {
  const identity = await clients.sts.send(new GetCallerIdentityCommand({}));
  return identity.Account;
}

export async function describeStack(
  clients: AwsClients,
  stackName: string,
): Promise<Stack | undefined> {
  try {
    const result = await clients.cloudFormation.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    return result.Stacks?.[0];
  } catch (error) {
    if (isAwsNotFound(error)) return undefined;
    throw error;
  }
}

export async function resolveScheduledTarget(
  clients: AwsClients,
  config: AwsOpsConfig,
): Promise<ScheduledTarget> {
  const stackResource = await clients.cloudFormation.send(
    new DescribeStackResourceCommand({
      StackName: config.stackName,
      LogicalResourceId: config.scheduledRuleLogicalId,
    }),
  );
  const ruleName = requireValue(
    stackResource.StackResourceDetail?.PhysicalResourceId,
    `CloudFormation stack ${config.stackName} does not include ${config.scheduledRuleLogicalId}`,
  );

  const targets = await clients.eventBridge.send(
    new ListTargetsByRuleCommand({ Rule: ruleName }),
  );
  const target = requireValue(
    targets.Targets?.[0],
    `EventBridge rule ${ruleName} does not include an ECS target`,
  );
  const clusterArn = requireValue(
    target.Arn,
    `EventBridge rule ${ruleName} target does not include a cluster ARN`,
  );
  const taskDefinitionArn = requireValue(
    target.EcsParameters?.TaskDefinitionArn,
    `EventBridge rule ${ruleName} target does not include a task definition ARN`,
  );
  const taskDefinition = await resolveTaskDefinition(
    clients,
    taskDefinitionArn,
  );
  const containerName = getContainerName(taskDefinition);
  const containerImage = requireValue(
    taskDefinition.containerDefinitions?.find(
      (container) => container.name === containerName,
    )?.image,
    `Container ${containerName} does not include an image`,
  );

  return {
    ruleName,
    target,
    clusterArn,
    taskDefinitionArn,
    taskDefinition,
    containerName,
    containerImage,
    networkConfiguration: requireNetworkConfig(target),
  };
}

export async function resolveTaskDefinition(
  clients: AwsClients,
  taskDefinitionArn: string,
): Promise<TaskDefinition> {
  const result = await clients.ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: taskDefinitionArn }),
  );
  return requireValue(
    result.taskDefinition,
    `ECS task definition ${taskDefinitionArn} was not found`,
  );
}

export function getContainerName(taskDefinition: TaskDefinition): string {
  if (process.env.CONTAINER_NAME) {
    return process.env.CONTAINER_NAME;
  }

  const containerDefinitions = requireValue(
    taskDefinition.containerDefinitions,
    "Task definition does not include container definitions",
  );
  if (containerDefinitions.length !== 1) {
    throw new Error(
      "Set CONTAINER_NAME when the task definition has multiple containers",
    );
  }

  return requireValue(
    containerDefinitions[0].name,
    "Task definition container does not include a name",
  );
}

function requireNetworkConfig(target: Target): EcsAwsVpcConfiguration {
  const vpcConfig = target.EcsParameters?.NetworkConfiguration
    ?.awsvpcConfiguration;
  if (!vpcConfig) {
    throw new Error("EventBridge target does not include awsvpc configuration");
  }
  return toEcsVpcConfiguration(vpcConfig);
}

function toEcsVpcConfiguration(
  vpcConfig: EventBridgeAwsVpcConfiguration,
): EcsAwsVpcConfiguration {
  return {
    subnets: requireValue(
      vpcConfig.Subnets,
      "EventBridge target awsvpc configuration does not include subnets",
    ),
    securityGroups: vpcConfig.SecurityGroups,
    assignPublicIp: vpcConfig.AssignPublicIp,
  };
}

function isAwsNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "ValidationError" || error.name === "ResourceNotFoundException")
  );
}
