# Alexa MCP Server Architecture

## Overview

The Alexa MCP Server is a **Cloudflare Workers-based Model Context Protocol (MCP) server** that provides intelligent home automation tools for AI agents. It serves as an adapter between MCP clients (like Poke, Claude Desktop, or custom agents) and the existing Alexa API infrastructure, enabling natural language control of smart home devices.

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Clients   │    │  Alexa MCP       │    │   Alexa API     │
│                 │    │     Server       │    │  Infrastructure │
│ • Poke          │◄──►│                  │◄──►│                 │
│ • Claude        │    │ • Tool routing   │    │ • Phoenix API   │
│ • Custom Agents │    │ • Validation     │    │ • GraphQL API   │
│                 │    │ • Error handling │    │ • Device State  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Smart Devices   │
                       │                  │
                       │ • Bedroom Light  │
                       │ • Echo Devices   │
                       │ • Sensors        │
                       └──────────────────┘
```

## Project Structure

```
alexa-mcp-server/
├── src/
│   ├── index.ts                 # Main Cloudflare Worker entry point
│   ├── api/                     # API route handlers
│   │   └── v1/
│   │       ├── announce.ts      # Announcement endpoints
│   │       ├── bedroom.ts       # Bedroom sensor data
│   │       ├── lights.ts        # Light control endpoints
│   │       ├── music.ts         # Music/Spotify status
│   │       └── weather.ts       # Weather information
│   ├── mcp/
│   │   ├── server.ts            # Main MCP server class
│   │   └── tools/               # Individual MCP tool implementations
│   │       ├── announcements.ts # Voice announcement tools
│   │       ├── bedroom.ts       # Bedroom monitoring tools
│   │       ├── lights.ts        # Light control tools
│   │       ├── music.ts         # Music status tools
│   │       └── weather.ts       # Weather information tools
│   ├── schemas/                 # Zod validation schemas
│   │   ├── announcements.ts
│   │   ├── lights.ts
│   │   ├── bedroom.ts
│   │   └── common.ts
│   ├── services/                # Business logic and external API calls
│   │   ├── alexa.ts            # Alexa API integration
│   │   ├── spotify.ts          # Spotify API integration
│   │   └── weather.ts          # Weather API integration
│   ├── types/                   # TypeScript type definitions
│   │   ├── env.ts              # Environment variable types
│   │   ├── mcp.ts              # MCP-specific types
│   │   └── alexa.ts            # Alexa API response types
│   └── lib/                     # Utility functions
│       ├── config.ts           # Configuration constants
│       ├── validation.ts       # Input validation helpers
│       └── errors.ts           # Error handling utilities
├── biome.json                   # Code formatting and linting
├── package.json
├── tsconfig.json
├── wrangler.jsonc              # Cloudflare Workers configuration
└── worker-configuration.d.ts   # Cloudflare Workers type definitions
```

## Core Components

### 1. Main Entry Point (`src/index.ts`)

The Cloudflare Worker handles two primary responsibilities:
- **MCP Protocol**: Serves MCP clients via SSE (`/sse`) and HTTP (`/mcp`) endpoints
- **REST API**: Provides HTTP endpoints mirroring the alexa-temp API for direct access

```typescript
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // MCP Protocol endpoints
    if (url.pathname === "/sse") {
      return AlexaMCP.serveSSE("/sse").fetch(request, env, ctx);
    }
    if (url.pathname === "/mcp") {
      return AlexaMCP.serve("/mcp").fetch(request, env, ctx);
    }
    
    // REST API endpoints
    return app.fetch(request, env, ctx);
  }
};
```

### 2. MCP Server (`src/mcp/server.ts`)

The core MCP server class extending `McpAgent` from the `agents` package:

```typescript
export class AlexaMCP extends McpAgent {
  server = new McpServer({
    name: "Alexa Home Automation",
    version: "1.0.0",
  });

  async init() {
    // Register all MCP tools
    this.registerAnnouncementTools();
    this.registerLightControlTools();
    this.registerBedroomMonitoringTools();
    this.registerMusicStatusTools();
    this.registerWeatherTools();
  }
}
```

### 3. Tool Architecture

Each MCP tool follows a consistent pattern:

```typescript
// Tool registration in server.ts
this.server.tool(
  "tool_name",
  "Human-readable description for AI agents",
  zodValidationSchema,
  toolImplementationFunction
);

// Tool implementation in src/mcp/tools/
export async function toolFunction(args: ToolArgs): Promise<ToolResult> {
  // Input validation
  // Business logic
  // External API calls
  // Response formatting
}
```

### 4. API Integration Layer (`src/services/`)

Handles communication with external APIs:

- **Alexa API**: Phoenix API for device control, GraphQL for power operations
- **Spotify API**: Music status and playback information
- **Weather API**: OpenWeatherMap integration for weather data

## MCP Tools Exposed

### Announcement Tools
- `alexa_announce(name, message, ssml?)` - Send voice announcements to Echo devices
- `announcement_template(situation, urgency)` - Generate contextual announcement text

### Light Control Tools
- `list_lights()` - Get all available smart lights and their capabilities
- `set_light_power(id, on, transitionMs?)` - Turn lights on/off with optional transition
- `set_light_brightness(id, level, transitionMs?)` - Set brightness level (0-100%)
- `set_light_color(id, mode, value, transitionMs?)` - Set color by name, hex, HSV, or Kelvin

### Bedroom Monitoring Tools
- `get_bedroom_state()` - Temperature, illuminance, and light status for context-aware decisions

### Music Status Tools
- `get_music_status()` - Current playback status from Alexa/Spotify integration

### Weather Information Tools
- `get_weather_summary()` - Current weather conditions and air quality

## MCP Resources (Live Context)

Provide real-time context for AI decision-making:

- `home://bedroom` - Live bedroom sensor data (temperature, illuminance, light state)
- `home://lights` - Current state of all smart lights
- `home://status` - Combined overview of home systems (music, weather, devices)
- `home://music` - Current playback status and track information

## Transport Methods

The server supports both standard MCP transport protocols:

### Server-Sent Events (SSE) - `/sse`
- Widely supported by current MCP clients
- Real-time bidirectional communication
- Automatic reconnection handling

### Streamable HTTP - `/mcp`
- Newer MCP standard
- Simplified request/response model
- Better for stateless interactions

## Authentication & Security

### Environment Variables
```bash
# Required for Alexa API integration
ALEXA_COOKIES="session_cookies_from_alexa_app"
