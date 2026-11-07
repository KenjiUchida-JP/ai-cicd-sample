import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();
const stack = new AppStack(app, 'test-app');
const template = Template.fromStack(stack);

test('the table is on-demand with the partition key id', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    });
});

test('the function runs Node.js 24 on arm64 with the table name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'aicicd-stg-notes-api',
        Runtime: 'nodejs24.x',
        Architectures: ['arm64'],
        Environment: {
            Variables: { TABLE_NAME: Match.anyValue() },
        },
    });
});

test('the HTTP API routes GET and POST /notes', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /notes',
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'POST /notes',
    });
});
