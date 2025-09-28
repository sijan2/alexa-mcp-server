import type { z } from "zod";
import {
	SetLightBrightnessSchema,
	SetLightColorSchema,
	SetLightPowerSchema,
} from "@/schemas/alexa";

export const setLightPowerSchema = SetLightPowerSchema;
export const setLightBrightnessSchema = SetLightBrightnessSchema;
export const setLightColorSchema = SetLightColorSchema;

async function getFirstAvailableLight(apiBase: string): Promise<string> {
	const response = await fetch(`${apiBase}/api/lights/list`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to get lights list: ${response.status}`);
	}

	const result = (await response.json()) as {
		lights: Array<{
			id: string;
			name: string;
			capabilities: string[];
		}>;
	};

	if (result.lights.length === 0) {
		throw new Error("No lights found in your account");
	}

	return result.lights[0].id;
}

export async function listLights(_args: Record<string, never>, ctx?: any) {
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

	try {
		const response = await fetch(`${apiBase}/api/lights/list`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to list lights: ${response.status}`);
		}

		const result = (await response.json()) as {
			lights: Array<{
				id: string;
				name: string;
				capabilities: string[];
			}>;
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							count: result.lights.length,
							lights: result.lights.map((light) => ({
								id: light.id,
								name: light.name,
								capabilities: light.capabilities,
							})),
							tip:
								result.lights.length === 1
									? "Since you have only one light, you can omit the 'id' parameter in other light commands."
									: "Use the 'id' field for specific light control, or omit it to control the first light.",
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
					text: `Error listing lights: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}

export async function setLightPower(args: z.infer<typeof setLightPowerSchema>, ctx?: any) {
	const { id, on, transitionMs } = args;

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

	try {
		// If no ID provided, get the first available light
		const lightId = id || (await getFirstAvailableLight(apiBase));

		const requestBody: any = { on };
		if (transitionMs !== undefined) {
			requestBody.transitionMs = transitionMs;
		}

		const response = await fetch(`${apiBase}/api/lights/${lightId}/power`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			throw new Error(`Light power control failed: ${response.status}`);
		}

		const result = await response.json();

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							success: true,
							lightId,
							action: on ? "turned on" : "turned off",
							result,
							message: `Light ${on ? "turned on" : "turned off"} successfully`,
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
					text: `Error controlling light power: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}

export async function setLightBrightness(
	args: z.infer<typeof setLightBrightnessSchema>,
	ctx?: any,
) {
	const { id, level, transitionMs } = args;

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

	try {
		// If no ID provided, get the first available light
		const lightId = id || (await getFirstAvailableLight(apiBase));

		const requestBody: any = { level };
		if (transitionMs !== undefined) {
			requestBody.transitionMs = transitionMs;
		}

		const response = await fetch(`${apiBase}/api/lights/${lightId}/brightness`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			throw new Error(`Light brightness control failed: ${response.status}`);
		}

		const result = await response.json();

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							success: true,
							lightId,
							brightness: level,
							result,
							message: `Light brightness set to ${level}%`,
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
					text: `Error setting light brightness: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}

export async function setLightColor(args: z.infer<typeof setLightColorSchema>, ctx?: any) {
	const { id, mode, value, transitionMs } = args;

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

	try {
		// If no ID provided, get the first available light
		const lightId = id || (await getFirstAvailableLight(apiBase));

		const requestBody: any = { mode, value };
		if (transitionMs !== undefined) {
			requestBody.transitionMs = transitionMs;
		}

		const response = await fetch(`${apiBase}/api/lights/${lightId}/color`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			throw new Error(`Light color control failed: ${response.status}`);
		}

		const result = await response.json();

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							success: true,
							lightId,
							color: { mode, value },
							result,
							message: `Light color set to ${value} (${mode} mode)`,
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
					text: `Error setting light color: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}
