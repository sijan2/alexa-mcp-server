import { Hono } from "hono";
import { cors } from "hono/cors";
import { announceHandler } from "@/api/v1/announce";
// Import API route handlers
import { bedroomHandler } from "@/api/v1/bedroom";
import { lightsApp } from "@/api/v1/lights";
import { musicHandler } from "@/api/v1/music";
import { volumeApp } from "@/api/v1/volume";
import { sensorsApp } from "@/api/v1/sensors";
import { dndApp } from "@/api/v1/dnd";
import { HomeIOMCP } from "@/mcp/server";
import type { Env } from "@/types/env";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use("*", cors());

// Health check
app.get("/", (c) => {
	return c.json({
		name: "Alexa MCP Server",
		version: "1.0.0",
		endpoints: {
			api: "/api",
			bedroom: "/api/bedroom",
			announce: "/api/announce",
			music: "/api/music",
			lights: "/api/lights",
			volume: "/api/volume",
			sensors: "/api/sensors",
			dnd: "/api/dnd",
			mcp: "/mcp",
			sse: "/sse",
			health: "/health",
		},
	});
});

// Health endpoint
app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
	});
});

// API v1 routes
app.get("/api/bedroom", bedroomHandler);
app.post("/api/announce", announceHandler);
app.get("/api/music", musicHandler);

// Light control routes
app.route("/api/lights", lightsApp);

// Volume control routes
app.route("/api/volume", volumeApp);

// Sensor routes
app.route("/api/sensors", sensorsApp);

// DND routes
app.route("/api/dnd", dndApp);

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return HomeIOMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return HomeIOMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Handle all other routes with Hono app
		return app.fetch(request, env, ctx);
	},
};

export { HomeIOMCP };
