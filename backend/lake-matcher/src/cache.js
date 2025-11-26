import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CACHE_TABLE_NAME, DISABLE_DYNAMO_CACHE } from './constants.js';

let docClient = null;

function getClient() {
  if (DISABLE_DYNAMO_CACHE) {
    return null;
  }
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2'
      })
    );
  }
  return docClient;
}

export async function checkCache(lakeName) {
  if (!lakeName || DISABLE_DYNAMO_CACHE) {
    return null;
  }
  try {
    const client = getClient();
    if (!client) {
      return null;
    }
    const response = await client.send(
      new GetCommand({
        TableName: CACHE_TABLE_NAME,
        Key: { lake_name: lakeName }
      })
    );
    if (!response.Item) {
      return null;
    }
    return {
      officialName: response.Item.official_name,
      lat: response.Item.lat,
      lng: response.Item.lng,
      matched_score: response.Item.matched_score,
      source: 'cache'
    };
  } catch (error) {
    console.warn(`[lake-matcher] Cache lookup failed: ${error.message}`);
    return null;
  }
}

export async function writeCache(lakeName, matchResult) {
  if (!lakeName || !matchResult || DISABLE_DYNAMO_CACHE) {
    return;
  }
  try {
    const client = getClient();
    if (!client) {
      return;
    }
    await client.send(
      new PutCommand({
        TableName: CACHE_TABLE_NAME,
        Item: {
          lake_name: lakeName,
          official_name: matchResult.officialName,
          lat: matchResult.lat,
          lng: matchResult.lng,
          matched_score: matchResult.matched_score,
          created_at: new Date().toISOString()
        }
      })
    );
  } catch (error) {
    console.warn(`[lake-matcher] Cache write failed: ${error.message}`);
  }
}
