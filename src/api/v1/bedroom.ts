import type { Context } from "hono";
import type {
	BrightnessCapability,
	ColorTempCapability,
	IlluminanceCapability,
	PowerStateCapability,
	TemperatureCapability,
} from "@/types/alexa";
import { type Env, EnvSchema } from "@/types/alexa";
import { ALEXA_ENDPOINT, buildAlexaHeaders } from "@/utils/alexa";
import { getEchoDeviceEntityId, getLightApplianceId, getCustomerSmartHomeEndpoints } from "@/utils/alexa-dynamic";

export async function bedroomHandler(c: Context<{ Bindings: Env }>) {
	// Validate environment
	const { UBID_MAIN, AT_MAIN } = c.env;

	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	// 🌐 Try edge cache first (5 s TTL)
	const cacheKey = new Request(c.req.url);
	const cached = await caches.default.match(cacheKey);
	if (cached) {
		return cached;
	}

	// Multi-strategy approach to find all possible entities
	const stateRequests = [];
	const addedEntityIds = new Set(); // Prevent duplicates

	// Strategy 1: Use helper functions (most targeted)
	try {
		const echoEntityId = await getEchoDeviceEntityId(c.env);
		if (echoEntityId && !addedEntityIds.has(echoEntityId)) {
			stateRequests.push({
				entityId: echoEntityId,
				entityType: "ENTITY",
			});
			addedEntityIds.add(echoEntityId);
			console.log(`Strategy 1 - Added Echo entity: ${echoEntityId}`);
		}
	} catch (error) {
		console.warn("Strategy 1 failed for Echo device:", error);
	}

	try {
		const lightApplianceId = await getLightApplianceId(c.env);
		if (lightApplianceId && !addedEntityIds.has(lightApplianceId)) {
			stateRequests.push({
				entityId: lightApplianceId,
				entityType: "APPLIANCE",
			});
			addedEntityIds.add(lightApplianceId);
			console.log(`Strategy 1 - Added light appliance: ${lightApplianceId}`);
		}
	} catch (error) {
		console.warn("Strategy 1 failed for light device:", error);
	}

	// Strategy 2: Comprehensive discovery from smart home endpoints
	try {
		const endpoints = await getCustomerSmartHomeEndpoints(c.env);
		
		for (const endpoint of endpoints) {
			// Add entity IDs (best for sensor data)
			const entityId = endpoint.legacyIdentifiers?.chrsIdentifier?.entityId || endpoint.entityId;
			if (entityId && !addedEntityIds.has(entityId)) {
				stateRequests.push({
					entityId,
					entityType: "ENTITY",
				});
				addedEntityIds.add(entityId);
			}

			// Add appliance IDs (best for device control)
			if (endpoint.legacyAppliance?.applianceId && !addedEntityIds.has(endpoint.legacyAppliance.applianceId)) {
				stateRequests.push({
					entityId: endpoint.legacyAppliance.applianceId,
					entityType: "APPLIANCE",
				});
				addedEntityIds.add(endpoint.legacyAppliance.applianceId);
			}

			// Add merged appliance IDs (often contain sensor data)
			if (endpoint.legacyAppliance?.mergedApplianceIds) {
				for (const mergedId of endpoint.legacyAppliance.mergedApplianceIds) {
					if (mergedId && !addedEntityIds.has(mergedId)) {
						stateRequests.push({
							entityId: mergedId,
							entityType: "APPLIANCE",
						});
						addedEntityIds.add(mergedId);
					}
				}
			}
		}
		console.log(`Strategy 2 - Added ${endpoints.length} endpoint variations`);
	} catch (error) {
		console.warn("Strategy 2 failed for smart home endpoints:", error);
	}

	// Strategy 3: Build AlexaBridge entity IDs from devices API
	try {
		const devicesResponse = await fetch("https://alexa.amazon.com/api/devices-v2/device?cached=true", {
			method: "GET",
			headers: buildAlexaHeaders(c.env, {
				Accept: "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
		});

		if (devicesResponse.ok) {
			const devicesData = await devicesResponse.json() as any;
			for (const device of devicesData.devices || []) {
				if (device.serialNumber && device.deviceType) {
					const bridgeEntityId = `AlexaBridge_${device.serialNumber}@${device.deviceType}_${device.serialNumber}`;
					if (!addedEntityIds.has(bridgeEntityId)) {
						stateRequests.push({
							entityId: bridgeEntityId,
							entityType: "APPLIANCE",
						});
						addedEntityIds.add(bridgeEntityId);
					}
				}
			}
		}
		console.log("Strategy 3 - Added AlexaBridge entities");
	} catch (error) {
		console.warn("Strategy 3 failed for devices API:", error);
	}

	if (stateRequests.length === 0) {
		return c.json({ error: "No devices found with any strategy" }, 404);
	}

	console.log(`Making state requests for ${stateRequests.length} entities using ${addedEntityIds.size} unique IDs`);

	const requestBody = JSON.stringify({ stateRequests });

	const res = await fetch(ALEXA_ENDPOINT, {
		method: "POST",
		headers: buildAlexaHeaders(c.env, { "Content-Type": "application/json; charset=utf-8" }),
		body: requestBody,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		return new Response(
			JSON.stringify({ error: "Alexa API error", status: res.status, body: text }),
			{
				status: res.status,
				headers: { "content-type": "application/json" },
			},
		);
	}

	const rawData = (await res.json()) as any;

	// Parse stringified capability states back to objects
	if (rawData.deviceStates) {
		for (const deviceState of rawData.deviceStates) {
			if (deviceState.capabilityStates) {
				deviceState.capabilityStates = deviceState.capabilityStates.map((cap: string) => {
					try {
						return typeof cap === "string" ? JSON.parse(cap) : cap;
					} catch {
						return cap; // Return as-is if parsing fails
					}
				});
			}
		}
	}

	// Use raw data without strict schema validation
	const data = rawData;

	let temp: TemperatureCapability | null = null;
	let lightPower: PowerStateCapability | null = null;
	let _lightBrightness: BrightnessCapability | null = null;
	let _lightColor: ColorTempCapability | null = null;
	let illuminance: IlluminanceCapability | null = null;
	let motionDetection: any = null;

	if (data.deviceStates && Array.isArray(data.deviceStates)) {
		for (const ds of data.deviceStates) {
			if (ds.capabilityStates && Array.isArray(ds.capabilityStates)) {
				// Process each capability state directly (they're already parsed JSON objects)
				for (const cap of ds.capabilityStates) {
					if (!cap || typeof cap !== 'object') continue;
					
					// Check for temperature sensor
					if (cap.namespace === "Alexa.TemperatureSensor" && cap.name === "temperature") {
						temp = cap as TemperatureCapability;
					}
					
					// Check for illuminance sensor  
					if (cap.namespace === "Alexa.LightSensor" && cap.name === "illuminance") {
						illuminance = cap as IlluminanceCapability;
					}
					
					// Check for light power state
					if (cap.namespace === "Alexa.PowerController" && cap.name === "powerState") {
						lightPower = cap as PowerStateCapability;
					}
					
					// Check for light brightness
					if (cap.namespace === "Alexa.BrightnessController" && cap.name === "brightness") {
						_lightBrightness = cap as BrightnessCapability;
					}
					
					// Check for color temperature
					if (cap.namespace === "Alexa.ColorTemperatureController" && cap.name === "colorTemperatureInKelvin") {
						_lightColor = cap as ColorTempCapability;
					}
					
					// Check for color properties
					if (cap.namespace === "Alexa.ColorPropertiesController" && cap.name === "colorProperties") {
						_lightColor = {
							...cap,
							value: (cap.value as any).name,
						} as unknown as ColorTempCapability;
					}
					
					// Check for motion sensor
					if (cap.namespace === "Alexa.MotionSensor" && cap.name === "detectionState") {
						motionDetection = cap;
					}
				}
			}
		}
	}

	// Extract temperature properly
	let temperatureCelsius: number | undefined;
	let temperatureFahrenheit: number | undefined;
	
	if (temp?.value && typeof temp.value === 'object' && 'value' in temp.value) {
		const tempValue = temp.value as { value: number; scale: string };
		if (tempValue.scale === 'CELSIUS') {
			temperatureCelsius = tempValue.value;
			temperatureFahrenheit = (tempValue.value * 9/5) + 32;
		} else if (tempValue.scale === 'FAHRENHEIT') {
			temperatureFahrenheit = tempValue.value;
			temperatureCelsius = (tempValue.value - 32) * 5/9;
		}
	}

	const response = {
		temperature: {
			celsius: temperatureCelsius || null,
			fahrenheit: temperatureFahrenheit || null,
		},
		illuminance: illuminance?.value || null,
		motion: {
			detected: motionDetection ? motionDetection.value === "DETECTED" : false,
			timestamp: motionDetection?.timeOfSample || null,
		},
		light: {
			on: lightPower ? lightPower.value === "ON" : false,
			brightness: _lightBrightness?.value || 0,
			color: _lightColor?.value || null,
		},
		lastUpdate: new Date().toISOString(),
		summary: `Temperature: ${temperatureFahrenheit ? `${Math.round(temperatureFahrenheit)}°F` : 'N/A°F'}, Illuminance: ${illuminance?.value || 'N/A'} lux, Motion: ${motionDetection ? (motionDetection.value === "DETECTED" ? "Detected" : "Not detected") : "N/A"}, Light: ${lightPower ? (lightPower.value === "ON" ? "On" : "Off") : "Off"}`,
		deviceStates: data.deviceStates ? data.deviceStates.map((ds: any) => ({
			entityId: ds.entity?.entityId || 'unknown',
			name: ds.entity?.entityType || 'unknown',
			value: ds.capabilityStates || [],
			timestamp: new Date().toISOString(),
		})) : [],
	};

	const cacheControl = "max-age=5";

	const jsonResponse = new Response(JSON.stringify(response), {
		headers: { "content-type": "application/json", "Cache-Control": cacheControl },
	});
	c.executionCtx?.waitUntil(caches.default.put(cacheKey, jsonResponse.clone()));
	return jsonResponse;
}
