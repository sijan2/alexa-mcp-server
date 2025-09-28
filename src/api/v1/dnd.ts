import { Hono } from "hono";
import type { Env } from "@/types/env";
import { buildAlexaHeaders } from "@/utils/alexa";


export const dndApp = new Hono<{ Bindings: Env }>();

// GET /api/dnd - Get DND status for all devices
dndApp.get("/", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing Alexa credentials" }, 500);
	}

	try {
		console.log("DND GET: Starting request to device-status-list");
		const headers = buildAlexaHeaders(c.env, {
			Accept: "application/json; charset=utf-8",
			"Cache-Control": "no-cache",
		});
		console.log("DND GET: Headers prepared, making request");
		
		const response = await fetch("https://alexa.amazon.com/api/dnd/device-status-list", {
			method: "GET",
			headers: headers,
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Alexa API error: ${response.status} - ${errorText}` }, 502);
		}

		const data = await response.json() as {
			doNotDisturbDeviceStatusList: Array<{
				deviceSerialNumber: string;
				deviceType: string;
				enabled: boolean;
			}>;
		};

		return c.json({
			devices: data.doNotDisturbDeviceStatusList.map(device => ({
				deviceSerialNumber: device.deviceSerialNumber,
				deviceType: device.deviceType,
				dndEnabled: device.enabled,
			})),
			totalDevices: data.doNotDisturbDeviceStatusList.length,
			enabledCount: data.doNotDisturbDeviceStatusList.filter(d => d.enabled).length,
			lastUpdate: new Date().toISOString(),
		});
	} catch (error) {
		console.error("DND GET: Caught error:", error);
		return c.json({ 
			error: `Failed to get DND status: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});

// PUT /api/dnd - Set DND status for a device
dndApp.put("/", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing Alexa credentials" }, 500);
	}

	try {
		const body = await c.req.json() as {
			deviceSerialNumber?: string;
			deviceType?: string;
			enabled: boolean;
		};

		if (!body.deviceSerialNumber || !body.deviceType) {
			return c.json({ error: "deviceSerialNumber and deviceType are required" }, 400);
		}

		const response = await fetch("https://alexa.amazon.com/api/dnd/status", {
			method: "PUT",
			headers: buildAlexaHeaders(c.env, {
				"Content-Type": "application/json; charset=utf-8",
				Accept: "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
				"X-Amzn-Requestid": crypto.randomUUID(),
				"Accept-Language": "en-US",
				"User-Agent": "PitanguiBridge/2.2.641803.0-[PLATFORM=Android][MANUFACTURER=Xiaomi][RELEASE=12][BRAND=Redmi][SDK=31][MODEL=Redmi Note 9 Pro]",
				"X-Amzn-Alexa-App": "eyJhcHBJZCI6ImFtem4xLmFwcGxpY2F0aW9uLmQ4MjQ4YzcxMWU4ODRlN2JhZjk5ZTZiMzdjN2MyOGIwIiwidmVyc2lvbiI6IjEuMCIsImFwcFZlcnNpb24iOiIyMDIyLjEwLjEwIn0=",
			}),
			body: JSON.stringify({
				deviceSerialNumber: body.deviceSerialNumber,
				deviceType: body.deviceType,
				enabled: body.enabled,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Alexa API error: ${response.status} - ${errorText}` }, 502);
		}

		const result = await response.json() as {
			deviceSerialNumber: string;
			deviceType: string;
			enabled: boolean;
		};

		return c.json({
			deviceSerialNumber: result.deviceSerialNumber,
			deviceType: result.deviceType,
			dndEnabled: result.enabled,
			success: true,
			message: `DND ${result.enabled ? 'enabled' : 'disabled'} successfully`,
			lastUpdate: new Date().toISOString(),
		});
	} catch (error) {
		return c.json({ 
			error: `Failed to set DND status: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});

// GET /api/dnd/:deviceSerial - Get DND status for specific device
dndApp.get("/:deviceSerial", async (c) => {
	const deviceSerial = c.req.param("deviceSerial");
	const { UBID_MAIN, AT_MAIN } = c.env;
	
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	try {
		const response = await fetch("https://alexa.amazon.com/api/dnd/device-status-list", {
			method: "GET",
			headers: buildAlexaHeaders(c.env, {
				Accept: "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Alexa API error: ${response.status} - ${errorText}` }, 502);
		}

		const data = await response.json() as {
			doNotDisturbDeviceStatusList: Array<{
				deviceSerialNumber: string;
				deviceType: string;
				enabled: boolean;
			}>;
		};

		const device = data.doNotDisturbDeviceStatusList.find(
			d => d.deviceSerialNumber === deviceSerial
		);

		if (!device) {
			return c.json({ error: "Device not found" }, 404);
		}

		return c.json({
			deviceSerialNumber: device.deviceSerialNumber,
			deviceType: device.deviceType,
			dndEnabled: device.enabled,
			lastUpdate: new Date().toISOString(),
		});
	} catch (error) {
		return c.json({ 
			error: `Failed to get device DND status: ${error instanceof Error ? error.message : "Unknown error"}` 
		}, 500);
	}
});