import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import type { Env } from "@/types/env";
import { announceAlexa, announceAlexaSchema } from "@/mcp/tools/announcements";
import { getBedroomState, getBedroomStateSchema } from "@/mcp/tools/bedroom";
import {
	listLights,
	setLightBrightness,
	setLightBrightnessSchema,
	setLightColor,
	setLightColorSchema,
	setLightPower,
	setLightPowerSchema,
} from "@/mcp/tools/lights";
import { getMusicStatus, getMusicStatusSchema } from "@/mcp/tools/music";
import {
	getAllDeviceVolumes,
	setVolume,
	setVolumeSchema,
	adjustVolume,
	adjustVolumeSchema,
} from "@/mcp/tools/volume";
import {
	getAllSensorData,
} from "@/mcp/tools/sensors";
import {
	listSmartHomeDevices,
	listSmartHomeDevicesSchema,
} from "@/mcp/tools/devices";
import {
	getDndStatus,
	setDndStatus,
	getDndStatusSchema,
	setDndStatusSchema,
} from "@/mcp/tools/dnd";

export class HomeIOMCP extends McpAgent<Env> {
	server = new McpServer({
		name: "Alexa Home Automation",
		version: "1.0.0",
	});

	async init() {
		// Announcement tools
		this.server.tool(
			"alexa_announce",
			"Send voice announcements to Alexa devices with smart suppression",
			announceAlexaSchema.shape,
			(args, ctx) => announceAlexa(args, { ...ctx, env: this.env }),
		);

		// Bedroom monitoring tools
		this.server.tool(
			"get_bedroom_state",
			"Get current bedroom temperature, illuminance, and light status for context-aware decisions",
			getBedroomStateSchema,
			(args, ctx) => getBedroomState(args, { ...ctx, env: this.env }),
		);

		// Light control tools
		this.server.tool(
			"list_lights",
			"Get all available smart lights and their capabilities. Shows how many lights you have and their IDs for reference.",
			{},
			(args, ctx) => listLights(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"set_light_power",
			"Turn smart light on or off. If you have only one light, no ID needed - it will be auto-detected.",
			setLightPowerSchema.shape,
			(args, ctx) => setLightPower(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"set_light_brightness",
			"Set smart light brightness (0-100%). If you have only one light, no ID needed - it will be auto-detected.",
			setLightBrightnessSchema.shape,
			(args, ctx) => setLightBrightness(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"set_light_color",
			"Set smart light color by name or Kelvin temperature. Supports full color spectrum and white shades. If you have only one light, no ID needed.",
			setLightColorSchema.shape,
			(args, ctx) => setLightColor(args, { ...ctx, env: this.env }),
		);

		// Music status tools
		this.server.tool(
			"get_music_status",
			"Get current music playbook status from Alexa/Spotify integration",
			getMusicStatusSchema,
			(args, ctx) => getMusicStatus(args, { ...ctx, env: this.env }),
		);

		// Volume control tools
		this.server.tool(
			"get_device_volumes",
			"Get current volume levels for all Alexa devices",
			{},
			(args, ctx) => getAllDeviceVolumes(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"set_device_volume",
			"Set volume level (0-100) for Alexa device. If you have only one device, no deviceType/dsn needed - it will be auto-detected.",
			setVolumeSchema.shape,
			(args, ctx) => setVolume(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"adjust_device_volume",
			"Adjust volume level by amount (-100 to +100) for Alexa device. If you have only one device, no deviceType/dsn needed - it will be auto-detected.",
			adjustVolumeSchema.shape,
			(args, ctx) => adjustVolume(args, { ...ctx, env: this.env }),
		);

		// Sensor tools
		this.server.tool(
			"get_all_sensor_data",
			"Get comprehensive sensor readings including temperature, illuminance, motion detection, and light status from all available sensors",
			{},
			(args, ctx) => getAllSensorData(args, { ...ctx, env: this.env }),
		);

		// Device discovery tools
		this.server.tool(
			"list_smarthome_devices",
			"List all available smart home devices with their capabilities, categories, and status information",
			listSmartHomeDevicesSchema,
			(args, ctx) => listSmartHomeDevices(args, { ...ctx, env: this.env }),
		);

		// Do Not Disturb tools
		this.server.tool(
			"get_dnd_status",
			"Get Do Not Disturb status for all Alexa devices",
			getDndStatusSchema,
			(args, ctx) => getDndStatus(args, { ...ctx, env: this.env }),
		);

		this.server.tool(
			"set_dnd_status",
			"Enable or disable Do Not Disturb mode for an Alexa device. If no device specified, uses the primary Echo device.",
			setDndStatusSchema.shape,
			(args, ctx) => setDndStatus(args, { ...ctx, env: this.env }),
		);

		// Note: Weather tools removed as they're handled by a different service
		// Resources temporarily disabled due to MCP SDK type compatibility issues

		// Prompts for generating contextual content
		this.server.prompt(
			"announcement_template",
			"Generate contextual announcement text based on situation and urgency",
			{
				situation: z
					.string()
					.describe(
						"The situation requiring an announcement (e.g., 'bus arriving', 'weather alert', 'reminder')",
					),
				urgency: z
					.enum(["low", "medium", "high"])
					.describe("Urgency level affecting tone and phrasing"),
			},
			async (args) => {
				const { situation, urgency } = args;
				let template = "";

				switch (urgency) {
					case "high":
						template = `URGENT: ${situation}. Please respond immediately.`;
						break;
					case "medium":
						template = `Attention: ${situation}. Please take action when convenient.`;
						break;
					default:
						template = `FYI: ${situation}. No immediate action required.`;
						break;
				}

				return {
					messages: [
						{
							role: "user",
							content: {
								type: "text",
								text: `Create an announcement for: ${template}`,
							},
						},
					],
				};
			},
		);
	}
}
