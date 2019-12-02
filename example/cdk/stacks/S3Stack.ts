import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import { CdkStackBase } from '../../../lib/CdkStackBase'

type Input = { removalPolicy: cdk.RemovalPolicy }
type Output = { myBucketArn: string }

export class S3Stack extends CdkStackBase<Input, Output> {
  createResources() {
    const myBucket = new s3.Bucket(this, this.name('MyBucket'), {
      removalPolicy: this.props.removalPolicy
    })

    this.createOutputsSsmParameters({ myBucketName: myBucket.bucketName })

    return {
      myBucketArn: myBucket.bucketArn
    }
  }
}
