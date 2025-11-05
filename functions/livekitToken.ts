import { Handler } from "@netlify/functions";
import { AccessToken } from "livekit-server-sdk";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();
admin.initializeApp();

const apiKey = process.env.LIVEKIT_KEY;
const apiSecret = process.env.LIVEKIT_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error("Missing LiveKit API credentials in environment variables.");
}

interface LiveKitRequest {
  queryStringParameters?: {
    room?: string;
  } | null;
  headers: {
    authorization?: string;
    [key: string]: string | undefined;
  };
  httpMethod: string;
}

export const handler: Handler = async (event, context) => {
  if (!event.queryStringParameters) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
      body: "LiveKit token function is up and running!",
    };
  }
  const req: LiveKitRequest = {
    queryStringParameters: event.queryStringParameters,
    headers: event.headers,
    httpMethod: event.httpMethod,
  };

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Missing or invalid Authorization header" }),
      };
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const room = req.queryStringParameters?.room;
    if (!room) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing room parameter" }),
      };
    }

    if (room !== uid) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Cannot request token for another user's room" }),
      };
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: uid });
    const grant = {
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    };

    at.addGrant(grant);
    (at as any).exp = Math.floor(Date.now() / 1000) + 3 * 3600;

    const token = at.toJwt();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    console.error("[LiveKitToken] Error:", err);
    const message = err instanceof Error ? err.message : "Token generation failed";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: message }),
    };
  }
};
