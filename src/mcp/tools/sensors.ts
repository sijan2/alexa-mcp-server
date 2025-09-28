

export async function getAllSensorData(_args: Record<string, never>, ctx?: any) {
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

	// Use the bedroom endpoint since it provides comprehensive sensor data
	const response = await fetch(`${apiBase}/api/bedroom`, {
		method: "GET",
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`Get sensor data failed: ${response.status} - ${errorText}`);
	}

	const result = await response.json();

	// Format as comprehensive sensor reading
	const sensorReading = {
		temperature: {
			celsius: (result as any).temperature?.celsius,
			fahrenheit: (result as any).temperature?.fahrenheit,
			reading: (result as any).temperature?.fahrenheit ? `${Math.round((result as any).temperature.fahrenheit)}°F (${Math.round((result as any).temperature.celsius)}°C)` : "Not available"
		},
		illuminance: {
			value: (result as any).illuminance,
			reading: (result as any).illuminance ? `${(result as any).illuminance} lux` : "Not available"
		},
		motion: {
			detected: (result as any).motion?.detected || false,
			timestamp: (result as any).motion?.timestamp || null,
			reading: (result as any).motion?.detected ? "Motion detected" : "No motion detected"
		},
		light: {
			on: (result as any).light?.on || false,
			brightness: (result as any).light?.brightness || 0,
			reading: `Light is ${(result as any).light?.on ? 'ON' : 'OFF'}${(result as any).light?.brightness ? ` at ${(result as any).light.brightness}%` : ''}`
		},
		summary: (result as any).summary,
		lastUpdate: (result as any).lastUpdate
	};

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(sensorReading, null, 2),
			},
		],
	};
}