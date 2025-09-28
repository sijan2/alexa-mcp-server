export const getBedroomStateSchema = {};

export async function getBedroomState(_args: Record<string, never>, ctx?: any) {
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

	const response = await fetch(`${apiBase}/api/bedroom`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Bedroom state request failed: ${response.status}`);
	}

	const result = (await response.json()) as {
		temperature?: { celsius?: number; fahrenheit?: number };
		illuminance?: number;
		motion?: { detected?: boolean; timestamp?: string | null };
		light?: { on?: boolean; brightness?: number; color?: string };
		lastUpdate?: string;
	};

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						temperature: {
							celsius: result.temperature?.celsius || null,
							fahrenheit: result.temperature?.fahrenheit || null,
						},
						illuminance: result.illuminance || null,
						motion: {
							detected: result.motion?.detected || false,
							timestamp: result.motion?.timestamp || null,
							occupancy: result.motion?.detected ? "Someone is in the room" : "Room is empty",
						},
						light: {
							on: result.light?.on || false,
							brightness: result.light?.brightness || 0,
							color: result.light?.color || null,
						},
						lastUpdate: result.lastUpdate || new Date().toISOString(),
						summary: `Temperature: ${result.temperature?.fahrenheit || "N/A"}°F, Illuminance: ${result.illuminance || "N/A"} lux, Motion: ${result.motion?.detected ? "Detected (Someone in room)" : "Not detected (Room empty)"}, Light: ${result.light?.on ? "On" : "Off"}`,
					},
					null,
					2,
				),
			},
		],
	};
}
