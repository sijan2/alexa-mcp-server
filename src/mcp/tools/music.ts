export const getMusicStatusSchema = {};

export async function getMusicStatus(_args: Record<string, never>, ctx?: any) {
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
		const response = await fetch(`${apiBase}/api/music`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Music status request failed: ${response.status}`);
		}

		const result = (await response.json()) as {
			isPlaying?: boolean;
			trackName?: string;
			artist?: string;
			album?: string;
			trackUrl?: string;
			provider?: string;
			mediaProgress?: number;
			mediaLength?: number;
			coverUrl?: string;
			timeOfSample?: string;
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							isPlaying: result.isPlaying || false,
							track: {
								name: result.trackName || null,
								artist: result.artist || null,
								album: result.album || null,
								url: result.trackUrl || null,
							},
							provider: result.provider || null,
							progress: {
								current: result.mediaProgress || null,
								total: result.mediaLength || null,
								percentage:
									result.mediaProgress && result.mediaLength
										? Math.round((result.mediaProgress / result.mediaLength) * 100)
										: null,
							},
							coverUrl: result.coverUrl || null,
							lastUpdate: result.timeOfSample || new Date().toISOString(),
							summary: result.isPlaying
								? `Playing: ${result.trackName || "Unknown"} by ${result.artist || "Unknown Artist"} on ${result.provider || "Unknown"}`
								: "No music currently playing",
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
					text: `Failed to get music status: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}
