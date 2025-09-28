import { Hono } from "hono";
import type { Env } from "@/types/env";
import { buildAlexaHeaders } from "@/utils/alexa";

export const volumeApp = new Hono<{ Bindings: Env }>();

// GET /api/volume - Get all device volumes
volumeApp.get("/", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	try {
		const response = await fetch("https://alexa.amazon.com/api/devices/deviceType/dsn/audio/v1/allDeviceVolumes", {
			method: "GET",
			headers: buildAlexaHeaders(c.env, {
				"Accept": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Get volumes failed: ${response.status} - ${errorText}` }, response.status as any);
		}

		const result = await response.json();
		return c.json(result);
	} catch (error) {
		return c.json({ error: `Get volumes failed: ${error instanceof Error ? error.message : "Unknown error"}` }, 500);
	}
});

// POST /api/volume/set - Set device volume
volumeApp.post("/set", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	const body = await c.req.json();
	const { deviceType, dsn, volume } = body;

	if (volume === undefined || volume < 0 || volume > 100) {
		return c.json({ error: "Volume must be between 0 and 100" }, 400);
	}

	// Get current volumes to find device
	const volumesResponse = await fetch("https://alexa.amazon.com/api/devices/deviceType/dsn/audio/v1/allDeviceVolumes", {
		method: "GET",
		headers: buildAlexaHeaders(c.env, {
			"Accept": "application/json; charset=utf-8",
			"Cache-Control": "no-cache",
		}),
	});

	if (!volumesResponse.ok) {
		return c.json({ error: "Failed to get current volumes" }, 500);
	}

	const volumesData = await volumesResponse.json() as any;
	if (!volumesData.volumes || volumesData.volumes.length === 0) {
		return c.json({ error: "No devices found" }, 404);
	}

	// Find target device or use first available
	let targetDevice: any;
	if (deviceType && dsn) {
		targetDevice = volumesData.volumes.find((v: any) => v.deviceType === deviceType && v.dsn === dsn);
		if (!targetDevice) {
			return c.json({ error: "Specified device not found" }, 404);
		}
	} else {
		targetDevice = volumesData.volumes[0];
	}

	const currentVolume = targetDevice.speakerVolume;
	const targetDeviceType = targetDevice.deviceType;
	const targetDsn = targetDevice.dsn;

	// Calculate amount needed to reach target volume
	const amount = volume - currentVolume;

	try {
		const response = await fetch(`https://alexa.amazon.com/api/devices/${targetDeviceType}/${targetDsn}/audio/v2/speakerVolume`, {
			method: "PUT",
			headers: buildAlexaHeaders(c.env, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
			body: JSON.stringify({
				dsn: targetDsn,
				deviceType: targetDeviceType,
				amount,
				volume: currentVolume,
				muted: false,
				synchronous: true,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Set volume failed: ${response.status} - ${errorText}` }, response.status as any);
		}

		const result = await response.json();
		return c.json(result);
	} catch (error) {
		return c.json({ error: `Set volume failed: ${error instanceof Error ? error.message : "Unknown error"}` }, 500);
	}
});

// POST /api/volume/adjust - Adjust device volume
volumeApp.post("/adjust", async (c) => {
	const { UBID_MAIN, AT_MAIN } = c.env;
	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	const body = await c.req.json();
	const { deviceType, dsn, amount } = body;

	if (amount === undefined || amount < -100 || amount > 100) {
		return c.json({ error: "Amount must be between -100 and 100" }, 400);
	}

	// Get current volumes to find device and current volume level
	const volumesResponse = await fetch("https://alexa.amazon.com/api/devices/deviceType/dsn/audio/v1/allDeviceVolumes", {
		method: "GET",
		headers: buildAlexaHeaders(c.env, {
			"Accept": "application/json; charset=utf-8",
			"Cache-Control": "no-cache",
		}),
	});

	if (!volumesResponse.ok) {
		return c.json({ error: "Failed to get current volumes" }, 500);
	}

	const volumesData = await volumesResponse.json() as any;
	if (!volumesData.volumes || volumesData.volumes.length === 0) {
		return c.json({ error: "No devices found" }, 404);
	}

	// Find target device or use first available
	let targetDevice: any;
	if (deviceType && dsn) {
		targetDevice = volumesData.volumes.find((v: any) => v.deviceType === deviceType && v.dsn === dsn);
		if (!targetDevice) {
			return c.json({ error: "Specified device not found" }, 404);
		}
	} else {
		targetDevice = volumesData.volumes[0];
	}

	const currentVolume = targetDevice.speakerVolume;
	const targetDeviceType = targetDevice.deviceType;
	const targetDsn = targetDevice.dsn;

	try {
		const response = await fetch(`https://alexa.amazon.com/api/devices/${targetDeviceType}/${targetDsn}/audio/v2/speakerVolume`, {
			method: "PUT",
			headers: buildAlexaHeaders(c.env, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
			}),
			body: JSON.stringify({
				dsn: targetDsn,
				deviceType: targetDeviceType,
				amount,
				volume: currentVolume,
				muted: false,
				synchronous: true,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			return c.json({ error: `Adjust volume failed: ${response.status} - ${errorText}` }, response.status as any);
		}

		const result = await response.json();
		return c.json(result);
	} catch (error) {
		return c.json({ error: `Adjust volume failed: ${error instanceof Error ? error.message : "Unknown error"}` }, 500);
	}
});