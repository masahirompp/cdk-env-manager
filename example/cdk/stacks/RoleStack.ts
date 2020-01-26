import * as iam from '@aws-cdk/aws-iam'
import { CdkStackBase } from '../../../lib/CdkStackBase'

type Input = { bucketArn: string }
type Export = { myRoleArn: string }

export class RoleStack extends CdkStackBase<Input, Export> {
  createResources() {
    const myManagedPolicy = new iam.ManagedPolicy(this, this.name('MyManagedRole'), {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [this.props.bucketArn]
        })
      ]
    })

    const myRole = new iam.Role(this, this.name('MyRole'), {
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
      managedPolicies: [myManagedPolicy]
    })

    return { myRoleArn: myRole.roleArn }
  }
}
