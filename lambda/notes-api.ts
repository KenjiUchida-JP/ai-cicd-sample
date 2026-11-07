import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
} from 'aws-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const MAX_TEXT_LENGTH = 200;

const respond = (
    statusCode: number,
    body: unknown,
): APIGatewayProxyResultV2 => ({
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

const parseText = (body: string | undefined): string | undefined => {
    try {
        const text: unknown = JSON.parse(body ?? '').text;
        if (typeof text !== 'string') {
            return undefined;
        }
        const trimmed = text.trim();
        return trimmed.length >= 1 && trimmed.length <= MAX_TEXT_LENGTH
            ? trimmed
            : undefined;
    } catch {
        return undefined;
    }
};

export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
        return respond(500, { message: 'TABLE_NAME is not set' });
    }

    switch (event.routeKey) {
        case 'GET /notes': {
            const result = await client.send(
                new ScanCommand({ TableName: tableName }),
            );
            return respond(200, { notes: result.Items ?? [] });
        }
        case 'POST /notes': {
            const text = parseText(event.body);
            if (text === undefined) {
                return respond(400, {
                    message: `text must be a string of 1 to ${MAX_TEXT_LENGTH} characters`,
                });
            }
            const note = {
                id: randomUUID(),
                text,
                createdAt: new Date().toISOString(),
            };
            await client.send(
                new PutCommand({ TableName: tableName, Item: note }),
            );
            return respond(201, note);
        }
        default:
            return respond(404, { message: 'Not Found' });
    }
};
