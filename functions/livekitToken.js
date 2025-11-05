"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
admin.initializeApp();
const apiKey = process.env.LIVEKIT_KEY;
const apiSecret = process.env.LIVEKIT_SECRET;
if (!apiKey || !apiSecret) {
    throw new Error("Missing LiveKit API credentials in environment variables.");
}
const handler = async (event, context) => {
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
    const req = {
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
        const at = new livekit_server_sdk_1.AccessToken(apiKey, apiSecret, { identity: uid });
        const grant = {
            roomJoin: true,
            room,
            canPublish: true,
            canSubscribe: true,
        };
        at.addGrant(grant);
        at.exp = Math.floor(Date.now() / 1000) + 3 * 3600;
        const token = at.toJwt();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token }),
        };
    }
    catch (err) {
        console.error("[LiveKitToken] Error:", err);
        const message = err instanceof Error ? err.message : "Token generation failed";
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: message }),
        };
    }
};
exports.handler = handler;
