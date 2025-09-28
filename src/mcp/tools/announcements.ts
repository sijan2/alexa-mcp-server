import type { z } from "zod";
import { AlexaAnnounceSchema } from "@/schemas/alexa";

export const announceAlexaSchema = AlexaAnnounceSchema;

export async function announceAlexa(args: z.infer<typeof announceAlexaSchema>, ctx?: any) {
	const { name, message } = args;

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

	const response = await fetch(`${apiBase}/api/announce`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name,
			message,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(`Announcement failed: ${response.status} - ${errorText}`);
	}

	const result = (await response.json()) as { playbackStatus?: string; deliveredTime?: string };

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						success: true,
						playbackStatus: result.playbackStatus,
						deliveredTime: result.deliveredTime,
						announcement: {
							name,
							message,
						},
					},
					null,
					2,
				),
			},
		],
	};
}
