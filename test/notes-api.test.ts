import {
    DynamoDBDocumentClient,
    PutCommand,
    ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../lambda/notes-api';

const ddbMock = mockClient(DynamoDBDocumentClient);

const call = async (routeKey: string, body?: string) => {
    const event = { routeKey, body } as APIGatewayProxyEventV2;
    return (await handler(event)) as APIGatewayProxyStructuredResultV2;
};

beforeEach(() => {
    ddbMock.reset();
    process.env.TABLE_NAME = 'test-notes';
});

const sample = { id: '1', text: 'hello', createdAt: '2026-11-01T00:00:00Z' };

describe('GET /notes', () => {
    test('returns the notes stored in the table', async () => {
        ddbMock.on(ScanCommand).resolves({ Items: [sample] });

        const res = await call('GET /notes');

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body ?? '')).toEqual({ notes: [sample] });
    });
});

describe('POST /notes', () => {
    test('stores a note and returns 201', async () => {
        ddbMock.on(PutCommand).resolves({});

        const res = await call(
            'POST /notes',
            JSON.stringify({ text: ' buy milk ' }),
        );

        expect(res.statusCode).toBe(201);
        const note = JSON.parse(res.body ?? '');
        expect(note.text).toBe('buy milk');
        expect(note.id).toEqual(expect.any(String));
        const put = ddbMock.commandCalls(PutCommand)[0].args[0].input;
        expect(put.TableName).toBe('test-notes');
        expect(put.Item).toEqual(note);
    });

    test.each([
        ['not JSON', 'not json'],
        ['no text', JSON.stringify({})],
        ['empty text', JSON.stringify({ text: '   ' })],
        ['too long', JSON.stringify({ text: 'a'.repeat(201) })],
    ])('rejects a body that is %s with 400', async (_name, body) => {
        const res = await call('POST /notes', body);

        expect(res.statusCode).toBe(400);
        expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });
});

test('returns 404 for an unknown route', async () => {
    expect((await call('GET /unknown')).statusCode).toBe(404);
});

test('returns 500 when TABLE_NAME is not set', async () => {
    delete process.env.TABLE_NAME;

    expect((await call('GET /notes')).statusCode).toBe(500);
});
