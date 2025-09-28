import type { Context } from "hono";
import { Hono } from "hono";
import type {
	BrightnessCapability,
	ColorPropertiesCapability,
	ColorTempCapability,
	DeviceState,
	PowerStateCapability,
} from "@/types/alexa";
import type { Env } from "@/types/env";
import { buildAlexaHeaders } from "@/utils/alexa";
import {
	buildEndpointId,
	extractEntityId,
	getLightApplianceId,
	getPrimaryLight,
	getSmartHomeEntities,
} from "@/utils/alexa-dynamic";

const lightsApp = new Hono<{ Bindings: Env }>();

// Amazon Alexa endpoints
const ALEXA_PHOENIX_ENDPOINT = "https://alexa.amazon.com/api/phoenix/state";
const ALEXA_NEXUS_ENDPOINT = "https://alexa.amazon.com/nexus/v1/graphql";

// Helper to get primary light dynamically
async function getPrimaryLightIds(env: Env) {
	const primaryLight = await getPrimaryLight(env);
	const entityId = extractEntityId(primaryLight);
	const endpointId = buildEndpointId(entityId);
	return { entityId, endpointId };
}

// Color name mappings (Amazon expects these exact names)
const WHITE_COLORS = ["warm_white", "soft_white", "white", "daylight_white", "cool_white"];

const ACTUAL_COLORS = [
	"red",
	"crimson",
	"salmon",
	"orange",
	"gold",
	"yellow",
	"green",
	"turquoise",
	"cyan",
	"sky_blue",
	"blue",
	"purple",
	"magenta",
	"pink",
	"lavender",
];

const SUPPORTED_COLORS = [...WHITE_COLORS, ...ACTUAL_COLORS];

// Helper to get current light state from Alexa
async function getLightState(c: Context<{ Bindings: Env }>, entityId: string) {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		throw new Error("Missing Alexa credentials");
	}

	const requestBody = JSON.stringify({
		stateRequests: [
			{
				entityId,
				entityType: "APPLIANCE",
				properties: [
					{ namespace: "Alexa.PowerController", name: "powerState" },
					{ namespace: "Alexa.BrightnessController", name: "brightness" },
					{
						namespace: "Alexa.ColorTemperatureController",
						name: "colorTemperatureInKelvin",
					},
					{ namespace: "Alexa.ColorPropertiesController", name: "colorProperties" },
					{ namespace: "Alexa.EndpointHealth", name: "connectivity" },
				],
			},
		],
	});

	const res = await fetch(ALEXA_PHOENIX_ENDPOINT, {
		method: "POST",
		headers: buildAlexaHeaders(c.env, { "Content-Type": "application/json; charset=utf-8" }),
		body: requestBody,
	});

	if (!res.ok) {
		throw new Error(`Alexa API error: ${res.status}`);
	}

	const data = (await res.json()) as { deviceStates?: DeviceState[] };
	return data.deviceStates?.[0];
}

// Helper to control light via Alexa Phoenix API
async function controlLight(
	c: Context<{ Bindings: Env }>,
	entityId: string,
	action: string,
	params: any = {},
) {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		throw new Error("Missing Alexa credentials");
	}

	const requestBody = JSON.stringify({
		controlRequests: [
			{
				entityId,
				entityType: "APPLIANCE",
				parameters: {
					action,
					...params,
				},
			},
		],
	});

	const res = await fetch(ALEXA_PHOENIX_ENDPOINT, {
		method: "PUT",
		headers: buildAlexaHeaders(c.env, { "Content-Type": "application/json; charset=utf-8" }),
		body: requestBody,
	});

	if (!res.ok) {
		throw new Error(`Alexa control API error: ${res.status}`);
	}

	return await res.json();
}

// Helper to control light via GraphQL (for power operations)
async function controlLightGraphQL(
	c: Context<{ Bindings: Env }>,
	endpointId: string,
	operation: string,
) {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		throw new Error("Missing Alexa credentials");
	}

	const query = `
    mutation togglePowerFeatureForEndpoint($endpointId: String, $featureOperationName: FeatureOperationName!) {
      setEndpointFeatures(
        setEndpointFeaturesInput: {featureControlRequests: [{endpointId: $endpointId, featureName: power, featureOperationName: $featureOperationName}]}
      ) {
        featureControlResponses {
          endpointId
          __typename
        }
        errors {
          endpointId
          code
          __typename
        }
        __typename
      }
    }
  `;

	const requestBody = JSON.stringify({
		operationName: "togglePowerFeatureForEndpoint",
		variables: {
			endpointId,
			featureOperationName: operation,
		},
		query,
	});

	// Get dynamic device headers
	const deviceHeaders = {
		"X-Amzn-Devicetype-Id": "A2TF17PFR55MTB",
		"X-Amzn-Build-Version": "953937113",
		"X-Amzn-Os-Version": "12",
		"X-Amzn-Devicetype": "phone",
	};

	try {
		const { getPrimaryMediaDevice } = await import("../../utils/alexa-dynamic");
		const primaryDevice = await getPrimaryMediaDevice(c.env);
		deviceHeaders["X-Amzn-Devicetype-Id"] = primaryDevice.deviceType;
	} catch (_error) {
		// Use defaults if we can't get device info
	}

	const res = await fetch(ALEXA_NEXUS_ENDPOINT, {
		method: "POST",
		headers: buildAlexaHeaders(c.env, {
			"Content-Type": "application/json",
			"X-Amzn-Marketplace-Id": "ATVPDKIKX0DER",
			"X-Amzn-Client": "AlexaApp",
			"X-Amzn-Os-Name": "android",
			...deviceHeaders,
		}),
		body: requestBody,
	});

	if (!res.ok) {
		throw new Error(`Alexa GraphQL API error: ${res.status}`);
	}

	return await res.json();
}

// List all lights
export async function listLights(c: Context<{ Bindings: Env }>) {
	try {
		const smartHomeDevices = await getSmartHomeEntities(c.env);

		// Filter for devices that are lights
		const lightDevices = smartHomeDevices.filter((device: any) => {
			const primaryCategory = device.displayInfo?.displayCategories?.primary?.value;
			return primaryCategory === "LIGHT";
		});

		const lights = lightDevices.map((device: any) => ({
			id: extractEntityId(device),
			name: device.favoriteFriendlyName || "Smart Light",
			capabilities: ["power", "brightness", "color", "colorTemperature"],
		}));

		return c.json({ lights });
	} catch (error) {
		console.error("Failed to list lights:", error);
		return c.json(
			{
				error: "Failed to fetch smart home devices",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
}

// Set up the lights sub-app with routes
lightsApp.get("/", listLights); // Default route for /api/lights
lightsApp.get("/list", listLights);
lightsApp.get("/:id/state", async (c) => {
	const id = c.req.param("id");

	// Verify this is a valid light entity ID
	try {
		const smartHomeDevices = await getSmartHomeEntities(c.env);
		const device = smartHomeDevices.find((device: any) => extractEntityId(device) === id);

		if (!device) {
			return c.json({ error: "Light not found" }, 404);
		}
	} catch (_error) {
		return c.json({ error: "Failed to verify light ID" }, 500);
	}

	try {
		// Use the appliance ID for state requests, not the entity ID
		const applianceId = await getLightApplianceId(c.env);
		const deviceState = await getLightState(c, applianceId);

		if (!deviceState) {
			return c.json({ error: "Failed to get light state" }, 500);
		}

		// Parse capabilities
		let power: PowerStateCapability | null = null;
		let brightness: BrightnessCapability | null = null;
		let colorTemp: ColorTempCapability | null = null;
		let colorProps: ColorPropertiesCapability | null = null;

		for (const rawCap of deviceState.capabilityStates) {
			try {
				const cap = JSON.parse(rawCap);
				if (cap.namespace === "Alexa.PowerController" && cap.name === "powerState") {
					power = cap;
				} else if (
					cap.namespace === "Alexa.BrightnessController" &&
					cap.name === "brightness"
				) {
					brightness = cap;
				} else if (
					cap.namespace === "Alexa.ColorTemperatureController" &&
					cap.name === "colorTemperatureInKelvin"
				) {
					colorTemp = cap;
				} else if (
					cap.namespace === "Alexa.ColorPropertiesController" &&
					cap.name === "colorProperties"
				) {
					colorProps = cap;
				}
			} catch (_e) {
				// Skip invalid JSON
			}
		}

		return c.json({
			id,
			name: "Bedroom Light",
			on: power?.value === "ON",
			brightness: brightness?.value || 0,
			color: {
				mode: colorProps ? "name" : colorTemp ? "tempK" : "unknown",
				value: colorProps?.value?.name || colorTemp?.value || "unknown",
			},
			colorTempK: colorTemp?.value,
			supports: {
				power: true,
				brightness: true,
				color: true,
				colorTemperature: true,
			},
			lastUpdate: power?.timeOfSample || new Date().toISOString(),
		});
	} catch (error) {
		return c.json({ error: `Failed to get light state: ${(error as Error).message}` }, 500);
	}
});

lightsApp.post("/:id/power", async (c) => {
	const id = c.req.param("id");

	// Get dynamic endpoint ID
	let endpointId: string;
	try {
		const { endpointId: dynamicEndpointId } = await getPrimaryLightIds(c.env);
		endpointId = dynamicEndpointId;
	} catch (_error) {
		return c.json({ error: "Failed to get light endpoint ID" }, 500);
	}

	try {
		const body = await c.req.json();
		const { on } = body;

		if (typeof on !== "boolean") {
			return c.json({ error: "Invalid power state. Must be true or false" }, 400);
		}

		const operation = on ? "turnOn" : "turnOff";
		const result = await controlLightGraphQL(c, endpointId, operation);

		return c.json({
			success: true,
			id,
			on,
			result,
		});
	} catch (error) {
		return c.json({ error: `Failed to control power: ${(error as Error).message}` }, 500);
	}
});

lightsApp.post("/:id/brightness", async (c) => {
	const id = c.req.param("id");

	try {
		const body = await c.req.json();
		const { level } = body;

		if (typeof level !== "number" || level < 0 || level > 100) {
			return c.json({ error: "Invalid brightness level. Must be 0-100" }, 400);
		}

		// Convert to 0-1 scale for Amazon
		const brightness = (level / 100).toString();

		const result = await controlLight(c, id, "setBrightness", { brightness });

		return c.json({
			success: true,
			id,
			brightness: level,
			result,
		});
	} catch (error) {
		return c.json({ error: `Failed to set brightness: ${(error as Error).message}` }, 500);
	}
});

lightsApp.post("/:id/color", async (c) => {
	const id = c.req.param("id");

	try {
		const body = await c.req.json();
		const { mode, value } = body;

		if (!mode || !value) {
			return c.json({ error: "Missing mode or value" }, 400);
		}

		let result: any;

		if (mode === "name" && SUPPORTED_COLORS.includes(value)) {
			if (WHITE_COLORS.includes(value)) {
				// Set color temperature by name for white shades
				result = await controlLight(c, id, "setColorTemperature", {
					colorTemperatureName: value,
				});
			} else {
				// Set color by name for actual colors
				result = await controlLight(c, id, "setColor", {
					colorName: value,
				});
			}
		} else if (mode === "tempK" && typeof value === "number") {
			// Set color temperature in Kelvin
			result = await controlLight(c, id, "setColorTemperature", {
				colorTemperatureInKelvin: value,
			});
		} else {
			return c.json(
				{
					error: "Unsupported color mode or value",
					supportedColors: SUPPORTED_COLORS,
					supportedModes: ["name", "tempK"],
				},
				400,
			);
		}

		return c.json({
			success: true,
			id,
			color: { mode, value },
			result,
		});
	} catch (error) {
		return c.json({ error: `Failed to set color: ${(error as Error).message}` }, 500);
	}
});

lightsApp.post("/:id/control", async (c) => {
	const id = c.req.param("id");

	// Get dynamic endpoint ID
	let endpointId: string;
	try {
		const { endpointId: dynamicEndpointId } = await getPrimaryLightIds(c.env);
		endpointId = dynamicEndpointId;
	} catch (_error) {
		return c.json({ error: "Failed to get light endpoint ID" }, 500);
	}

	try {
		const body = await c.req.json();
		const { featureOperationName, brightness, color } = body;

		let result: any;

		switch (featureOperationName) {
			case "turnOn":
			case "turnOff":
				result = await controlLightGraphQL(c, endpointId, featureOperationName);
				break;
			case "setBrightness":
				if (typeof brightness !== "number" || brightness < 0 || brightness > 1) {
					return c.json({ error: "Invalid brightness. Must be 0-1" }, 400);
				}
				result = await controlLight(c, id, "setBrightness", {
					brightness: brightness.toString(),
				});
				break;
			default:
				return c.json({ error: "Unsupported operation" }, 400);
		}

		// Handle color change if provided
		if (color && SUPPORTED_COLORS.includes(color)) {
			try {
				await controlLight(c, id, "setColor", { colorName: color });
			} catch (_e) {
				// Color change failed but main operation might have succeeded
			}
		}

		return c.json({
			success: true,
			endpointId: id,
			operation: featureOperationName,
			result,
		});
	} catch (error) {
		return c.json({ error: `Failed to control light: ${(error as Error).message}` }, 500);
	}
});

export { lightsApp };
