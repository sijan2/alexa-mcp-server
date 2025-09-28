import type { z } from "zod";
import { AllDeviceVolumesSchema, SetVolumeSchema, AdjustVolumeSchema } from "@/schemas/alexa";

export const getAllDeviceVolumesSchema = AllDeviceVolumesSchema;
export const setVolumeSchema = SetVolumeSchema;
export const adjustVolumeSchema = AdjustVolumeSchema;

export async function getAllDeviceVolumes(_args: Record<string, never>, ctx?: any) {
	// Access environment variables from context
	const apiBase = ctx?.env?.API_BASE;

	if (!apiBase) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: API_BASE environment variable is required but not found in context or process.env",
				},
			],
			isError: true,
		};
	}

	const response = await fetch(`${apiBase}/api/volume`, {
		method: "GET",
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`Get volumes failed: ${response.status} - ${errorText}`);
	}

	const result = await response.json();

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(result, null, 2),
			},
		],
	};
}

export async function setVolume(args: z.infer<typeof setVolumeSchema>, ctx?: any) {
	const { deviceType, dsn, volume } = args;

	// Access environment variables from context
	const apiBase = ctx?.env?.API_BASE;

	if (!apiBase) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: API_BASE environment variable is required but not found in context or process.env",
				},
			],
			isError: true,
		};
	}

	const response = await fetch(`${apiBase}/api/volume/set`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			deviceType,
			dsn,
			volume,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`Set volume failed: ${response.status} - ${errorText}`);
	}

	const result = await response.json();

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						success: true,
						...(result as any),
						request: {
							deviceType,
							dsn,
							volume,
						},
					},
					null,
					2,
				),
			},
		],
	};
}

export async function adjustVolume(args: z.infer<typeof adjustVolumeSchema>, ctx?: any) {
	const { deviceType, dsn, amount } = args;

	// Access environment variables from context
	const apiBase = ctx?.env?.API_BASE;

	if (!apiBase) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: API_BASE environment variable is required but not found in context or process.env",
				},
			],
			isError: true,
		};
	}

	const response = await fetch(`${apiBase}/api/volume/adjust`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			deviceType,
			dsn,
			amount,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`Adjust volume failed: ${response.status} - ${errorText}`);
	}

	const result = await response.json();

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						success: true,
						...(result as any),
						request: {
							deviceType,
							dsn,
							amount,
						},
					},
					null,
					2,
				),
			},
		],
	};
}