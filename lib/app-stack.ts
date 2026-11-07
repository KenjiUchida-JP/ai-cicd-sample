import * as cdk from 'aws-cdk-lib/core';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class AppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const table = new dynamodb.Table(this, 'NotesTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const fn = new NodejsFunction(this, 'NotesApiFunction', {
            functionName: 'aicicd-stg-notes-api',
            entry: 'lambda/notes-api.ts',
            runtime: lambda.Runtime.NODEJS_24_X,
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            environment: { TABLE_NAME: table.tableName },
        });
        table.grantReadWriteData(fn);

        const api = new apigwv2.HttpApi(this, 'NotesHttpApi', {
            apiName: 'aicicd-stg-notes-api',
        });
        const integration = new HttpLambdaIntegration('NotesIntegration', fn);
        api.addRoutes({
            path: '/notes',
            methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
            integration,
        });

        new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    }
}
