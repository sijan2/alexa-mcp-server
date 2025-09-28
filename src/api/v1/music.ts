import type { Context } from "hono";
import type { Env } from "@/types/env";
import { getAmazonMusicPlayback } from "@/utils/alexa";

/**
 * GET /api/music – Returns now-playing information for the primary Alexa device.
 *
 * This implementation fetches the Alexa "list-media-sessions" endpoint directly,
 * which provides rich playback metadata (title, artist, artwork) along with
 * progress (current position & length) for both Amazon Music and Spotify.
 *
 * Updated to use dynamic device discovery to find the correct device automatically.
 */
export async function musicHandler(c: Context<{ Bindings: Env }>) {
	try {
		// Debug: Log device discovery
		console.log("Music API: Starting device discovery...");
		
		// Try Alexa now-playing first with dynamic device discovery
		const playback = await getAmazonMusicPlayback(c.env);
		
		console.log("Music API: Playback result:", playback ? "Found data" : "No data");
		
		if (playback) {
			return c.json({
				isPlaying: playback.isPlaying,
				trackName: playback.trackName,
				artist: playback.artist,
				album: playback.album,
				coverUrl: playback.coverUrl,
				provider: playback.provider,
				mediaProgress: playback.mediaProgress,
				mediaLength: playback.mediaLength,
				timeOfSample: new Date().toISOString(),
				trackUrl: null, // Not available in this API
			});
		}

		// Alexa returned no session – fall back to no data
		return c.json({
			isPlaying: false,
			trackName: null,
			artist: null,
			album: null,
			coverUrl: null,
			provider: null,
			mediaProgress: null,
			mediaLength: null,
			timeOfSample: new Date().toISOString(),
			trackUrl: null,
		});
	} catch (error) {
		console.error("Music API error:", error);
		return c.json({
			isPlaying: false,
			trackName: null,
			artist: null,
			album: null,
			coverUrl: null,
			provider: null,
			mediaProgress: null,
			mediaLength: null,
			timeOfSample: new Date().toISOString(),
			trackUrl: null,
			error: error instanceof Error ? error.message : "Unknown error",
		}, 500);
	}
}
