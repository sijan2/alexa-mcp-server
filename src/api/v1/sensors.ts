import { Hono } from "hono";
import type { Env } from "@/types/env";
import { buildAlexaHeaders } from "@/utils/alexa";

export const sensorsApp = new Hono<{ Bindings: Env }>();

// GET /api/sensors - List all available sensors
sensorsApp.get("/", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	try {
		// Get devices without strict schema validation
		const devicesResponse = await fetch("https://alexa.amazon.com/api/devices-v2/device?cached=true", {
			method: "GET",
			headers: buildAlexaHeaders(c.env, {
				Accept: "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
		});

		if (!devicesResponse.ok) {
			throw new Error(`Failed to fetch devices: ${devicesResponse.status}`);
		}

	const devicesData = await devicesResponse.json() as any;
	const devices = devicesData.devices || [];

		const sensors: any[] = [];

		// Find Echo devices with sensors - use broad detection since we know from bedroom data that sensors exist
		for (const device of devices) {
			// For Echo devices, assume they have sensors if they're Echo family devices
			if (device.deviceFamily === "ECHO" || (device.deviceType?.includes("ECHO")) || 
				device.accountName?.toLowerCase().includes("echo") || device.deviceName?.toLowerCase().includes("echo")) {
				
				// Default sensor types for Echo devices based on what we see in bedroom endpoint
				const sensorTypes = ["temperature", "illuminance", "motion", "acoustic"];

				sensors.push({
					entityId: `AlexaBridge_${device.serialNumber}@${device.deviceType}_${device.serialNumber}`,
					deviceType: device.deviceType,
					friendlyName: device.accountName || device.deviceName || `${device.deviceFamily || 'Echo'} Device`,
					deviceFamily: device.deviceFamily,
					capabilities: sensorTypes,
					online: device.online !== false,
					serialNumber: device.serialNumber,
					rawCapabilities: device.capabilities, // Include raw caps for debugging
				});
			}
		}

		// If no Echo devices found, include all devices for debugging
		if (sensors.length === 0) {
			for (const device of devices) {
				sensors.push({
					entityId: device.serialNumber || device.deviceSerialNumber || device.deviceType,
					deviceType: device.deviceType,
					friendlyName: device.accountName || device.deviceName || "Unknown Device",
					deviceFamily: device.deviceFamily,
					capabilities: ["debug"],
					online: device.online !== false,
					serialNumber: device.serialNumber,
					rawCapabilities: device.capabilities,
					rawDevice: device, // Full device for debugging
				});
			}
		}

		return c.json({
			sensors,
			totalCount: sensors.length,
			categories: ["temperature", "illuminance", "motion", "acoustic"]
		});
	} catch (error) {
		return c.json({ 
			error: `Failed to list sensors: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});

// GET /api/sensors/all - Get data from all sensors
sensorsApp.get("/all", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	try {
		// Get devices directly without schema validation
		const devicesResponse = await fetch("https://alexa.amazon.com/api/devices-v2/device?cached=true", {
			method: "GET",
			headers: buildAlexaHeaders(c.env, {
				Accept: "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
		});

		if (!devicesResponse.ok) {
			throw new Error(`Failed to fetch devices: ${devicesResponse.status}`);
		}

	const devicesData = await devicesResponse.json() as any;
	const devices = devicesData.devices || [];

		const stateRequests: any[] = [];

		// Add Echo devices with sensor capabilities using entity IDs from the working bedroom endpoint
		for (const device of devices) {
			if (device.online !== false && device.capabilities && Array.isArray(device.capabilities)) {
				const hasSensors = device.capabilities.some((cap: string) => 
					typeof cap === 'string' && (
						cap.includes("TemperatureSensor") ||
						cap.includes("LightSensor") ||
						cap.includes("MotionSensor") ||
						cap.includes("AcousticEventSensor")
					)
				);

				if (hasSensors) {
					// Use the entity ID format that works in the bedroom endpoint
					const entityId = `AlexaBridge_${device.serialNumber}@${device.deviceType}_${device.serialNumber}`;
					stateRequests.push({
						entityId,
						entityType: "APPLIANCE",
					});
				}
			}
		}

		if (stateRequests.length === 0) {
			return c.json({ sensors: [], message: "No sensors found" });
		}

		const response = await fetch("https://alexa.amazon.com/api/phoenix/state", {
			method: "POST",
			headers: buildAlexaHeaders(c.env, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
			body: JSON.stringify({ stateRequests }),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Alexa API error: ${response.status} - ${errorText}` }, response.status as any);
		}

		const data = await response.json() as any;
		
		// Parse sensor data
		const sensors: any[] = [];
		
		if (data.deviceStates) {
			for (const deviceState of data.deviceStates) {
				const sensorData: any = {
					entityId: deviceState.entity.entityId,
					entityType: deviceState.entity.entityType,
					capabilities: {},
					lastUpdate: new Date().toISOString(),
				};

				// Parse capability states
				for (const capString of deviceState.capabilityStates) {
					try {
						const cap = typeof capString === 'string' ? JSON.parse(capString) : capString;
						
						if (cap.namespace === "Alexa.TemperatureSensor" && cap.name === "temperature") {
							sensorData.capabilities.temperature = {
								value: cap.value?.value,
								scale: cap.value?.scale,
								timestamp: cap.timeOfSample,
							};
						} else if (cap.namespace === "Alexa.LightSensor" && cap.name === "illuminance") {
							sensorData.capabilities.illuminance = {
								value: cap.value,
								timestamp: cap.timeOfSample,
							};
						} else if (cap.namespace === "Alexa.MotionSensor" && cap.name === "detectionState") {
							sensorData.capabilities.motion = {
								detected: cap.value === "DETECTED",
								timestamp: cap.timeOfSample,
							};
						}
					} catch (_error) {
						// Skip invalid JSON
					}
				}

				if (Object.keys(sensorData.capabilities).length > 0) {
					sensors.push(sensorData);
				}
			}
		}

		return c.json({
			sensors,
			totalCount: sensors.length,
			lastUpdate: new Date().toISOString(),
		});
	} catch (error) {
		return c.json({ 
			error: `Failed to get sensor data: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});

// GET /api/sensors/:entityId - Get data from specific sensor
sensorsApp.get("/:entityId", async (c) => {
	const entityId = c.req.param("entityId");
	const { UBID_MAIN, AT_MAIN } = c.env;
	
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	try {
		const response = await fetch("https://alexa.amazon.com/api/phoenix/state", {
			method: "POST",
			headers: buildAlexaHeaders(c.env, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
			body: JSON.stringify({
				stateRequests: [
					{
						entityId,
						entityType: "APPLIANCE",
						properties: [
							{ namespace: "Alexa.TemperatureSensor", name: "temperature" },
							{ namespace: "Alexa.LightSensor", name: "illuminance" },
							{ namespace: "Alexa.MotionSensor", name: "detectionState" },
							{ namespace: "Alexa.AcousticEventSensor", name: "detectionModes" },
						],
					},
				],
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Alexa API error: ${response.status} - ${errorText}` }, response.status as any);
		}

		const data = await response.json() as any;
		
		if (!data.deviceStates || data.deviceStates.length === 0) {
			return c.json({ error: "Sensor not found" }, 404);
		}

		const deviceState = data.deviceStates[0];
		const sensorData: any = {
			entityId: deviceState.entity.entityId,
			entityType: deviceState.entity.entityType,
			capabilities: {},
			rawCapabilities: deviceState.capabilityStates,
			lastUpdate: new Date().toISOString(),
		};

		// Parse capability states
		for (const capString of deviceState.capabilityStates) {
			try {
				const cap = typeof capString === 'string' ? JSON.parse(capString) : capString;
				
				if (cap.namespace === "Alexa.TemperatureSensor" && cap.name === "temperature") {
					sensorData.capabilities.temperature = {
						value: cap.value?.value,
						scale: cap.value?.scale,
						timestamp: cap.timeOfSample,
					};
				} else if (cap.namespace === "Alexa.LightSensor" && cap.name === "illuminance") {
					sensorData.capabilities.illuminance = {
						value: cap.value,
						timestamp: cap.timeOfSample,
					};
				} else if (cap.namespace === "Alexa.MotionSensor" && cap.name === "detectionState") {
					sensorData.capabilities.motion = {
						detected: cap.value === "DETECTED",
						timestamp: cap.timeOfSample,
					};
				}
			} catch (_error) {
				// Skip invalid JSON
			}
		}

		return c.json(sensorData);
	} catch (error) {
		return c.json({ 
			error: `Failed to get sensor data: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});