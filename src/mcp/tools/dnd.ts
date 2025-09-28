import { z } from "zod";
import { getCustomerSmartHomeEndpoints } from "@/utils/alexa-dynamic";

export const getDndStatusSchema = {};

export const setDndStatusSchema = z.object({
	deviceSerialNumber: z.string().optional().describe("Device serial number. If not provided, uses the primary Echo device"),
	deviceType: z.string().optional().describe("Device type. If not provided, uses the primary Echo device"),
	enabled: z.boolean().describe("Enable or disable Do Not Disturb mode"),
});

export async function getDndStatus(_args: Record<string, never>, ctx?: any) {
	// Access environment variables from context
	const apiBase = ctx?.env?.API_BASE;

	if (!apiBase) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: API_BASE environment variable is required but not found in context",
				},
			],
			isError: true,
		};
	}

	try {
		const response = await fetch(`${apiBase}/api/dnd`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`DND status request failed: ${response.status}`);
		}

		const result = await response.json() as {
			devices: Array<{
				deviceSerialNumber: string;
				deviceType: string;
				dndEnabled: boolean;
			}>;
			totalDevices: number;
			enabledCount: number;
			lastUpdate: string;
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							devices: result.devices,
							summary: {
								totalDevices: result.totalDevices,
								dndEnabledDevices: result.enabledCount,
								dndDisabledDevices: result.totalDevices - result.enabledCount,
							},
							lastUpdate: result.lastUpdate,
						},
						null,
						2,
					),
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text" as const,
					text: `Failed to get DND status: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}

export async function setDndStatus(args: z.infer<typeof setDndStatusSchema>, ctx?: any) {
	const apiBase = ctx?.env?.API_BASE;

	if (!apiBase) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: API_BASE environment variable is required but not found in context",
				},
			],
			isError: true,
		};
	}

	try {
		let { deviceSerialNumber, deviceType, enabled } = args;

		// If device info not provided, get primary Echo device
		if (!deviceSerialNumber || !deviceType) {
			const endpoints = await getCustomerSmartHomeEndpoints(ctx.env);
			
			// Find Echo device (ALEXA_VOICE_ENABLED category)
			const echoDevice = endpoints.find((endpoint: any) => {
				const primaryCategory = endpoint.displayCategories?.primary?.value;
				return primaryCategory === "ALEXA_VOICE_ENABLED";
			});
			
			if (!echoDevice) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No Echo device found for DND control",
						},
					],
					isError: true,
				};
			}
			
			deviceSerialNumber = echoDevice.legacyIdentifiers?.dmsIdentifier?.deviceSerialNumber?.value?.text;
			deviceType = echoDevice.legacyIdentifiers?.dmsIdentifier?.deviceType?.value?.text;
			
			if (!deviceSerialNumber || !deviceType) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Could not extract device serial number or type from Echo device",
						},
					],
					isError: true,
				};
			}
		}

		const response = await fetch(`${apiBase}/api/dnd`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				deviceSerialNumber,
				deviceType,
				enabled,
			}),
		});

		if (!response.ok) {
			throw new Error(`DND set request failed: ${response.status}`);
		}

		const result = await response.json() as {
			deviceSerialNumber: string;
			deviceType: string;
			dndEnabled: boolean;
			success: boolean;
			message: string;
			lastUpdate: string;
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							success: result.success,
							message: result.message,
							device: {
								serialNumber: result.deviceSerialNumber,
								deviceType: result.deviceType,
								dndEnabled: result.dndEnabled,
							},
							lastUpdate: result.lastUpdate,
						},
						null,
						2,
					),
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text" as const,
					text: `Failed to set DND status: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}