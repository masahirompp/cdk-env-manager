import * as cdk from "@aws-cdk/core";
import { CdkAppBase } from "../../lib/CdkAppBase";
import { RoleStack } from "./stacks/RoleStack";
import { S3Stack } from "./stacks/S3Stack";

type Parameter = { removalPolicy: cdk.RemovalPolicy };

export class MyApp extends CdkAppBase<Parameter> {
  async createStacks() {
    const s3Stack = new S3Stack(this, "S3Stack", {
      removalPolicy: this.deployParameters.removalPolicy,
    });

    // eslint-disable-next-line no-new
    new RoleStack(this, "RoleBucket", {
      bucketArn: s3Stack.exports.myBucketArn,
    });
  }
}

const app = new MyApp();
app.synth();
