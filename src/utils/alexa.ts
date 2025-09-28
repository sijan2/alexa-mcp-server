import type { Env, PowerStateCapability } from "@/types/alexa";
import { getAccountInfo, getCustomerSmartHomeEndpoints } from "@/utils/alexa-dynamic";

export const ALEXA_ENDPOINT = "https://alexa.amazon.com/api/phoenix/state";

// Dynamic account ID helper
export async function getAccountId(env: Env): Promise<string> {
	const accountInfo = await getAccountInfo(env);
	return accountInfo.customerId;
}

// Shared User-Agent and header helpers
const USER_AGENT =
	"PitanguiBridge/2.2.629941.0-[PLATFORM=Android][MANUFACTURER=samsung][RELEASE=12][BRAND=Redmi][SDK=31][MODEL=SM-S928B]";

export function buildAlexaHeaders(env: Env, additional: Record<string, string> = {}) {
	// Build cookie string from individual components
	const cookieString = `csrf=1; ubid-main=${env.UBID_MAIN}; at-main=${env.AT_MAIN}`;

	const headers: Record<string, string> = {
		Cookie: cookieString,
		Csrf: "1",
		Accept: "application/json; charset=utf-8",
		"Accept-Language": "en-US",
		"User-Agent": USER_AGENT,
		...additional,
	};

	return headers;
}

// Note: State request body is now dynamically generated in bedroom handler

// Helper to check if any light is currently ON via Alexa Phoenix state
export async function isAnyLightOn(env: Env): Promise<boolean | null> {
	const { UBID_MAIN, AT_MAIN } = env;
	if (!UBID_MAIN || !AT_MAIN) return null;

	try {
		const { getPrimaryLight, extractEntityId } = await import("./alexa-dynamic");
		const primaryLight = await getPrimaryLight(env);
		const entityId = extractEntityId(primaryLight);

		const body = JSON.stringify({
			stateRequests: [
				{
					entityId,
					entityType: "APPLIANCE",
					properties: [{ namespace: "Alexa.PowerController", name: "powerState" }],
				},
			],
		});

		const res = await fetch(ALEXA_ENDPOINT, {
			method: "POST",
			headers: buildAlexaHeaders(env, { "Content-Type": "application/json; charset=utf-8" }),
			body,
		});

		if (!res.ok) return null;

		const data = (await res.json()) as { deviceStates?: Array<{ capabilityStates: string[] }> };
		const powerCap = data.deviceStates?.[0]?.capabilityStates
			.flatMap((raw) => {
				try {
					return [JSON.parse(raw) as PowerStateCapability];
				} catch {
					return [];
				}
			})
			.find((cap) => cap.namespace === "Alexa.PowerController" && cap.name === "powerState");

		return powerCap ? powerCap.value === "ON" : null;
	} catch (error) {
		console.warn("Failed to check light state:", error);
		return null;
	}
}

// Helper to get now-playing info from Amazon Music via Alexa NP endpoint
export async function getAmazonMusicPlayback(env: Env) {
	const { UBID_MAIN, AT_MAIN } = env;

	if (!UBID_MAIN || !AT_MAIN) return null;

	// Get Echo device from GraphQL endpoint (has proper serial/deviceType)
	let deviceSerial: string;
	let deviceType: string;
	try {
		const endpoints = await getCustomerSmartHomeEndpoints(env);
		
		// Find Echo device (ALEXA_VOICE_ENABLED category)
		const echoDevice = endpoints.find((endpoint: any) => {
			const primaryCategory = endpoint.displayCategories?.primary?.value;
			return primaryCategory === "ALEXA_VOICE_ENABLED";
		});
		
		if (!echoDevice) {
			console.warn("No Echo device found for music queries");
			return null;
		}
		
		// Extract serial number and device type from DMS identifier
		deviceSerial = echoDevice.legacyIdentifiers?.dmsIdentifier?.deviceSerialNumber?.value?.text;
		deviceType = echoDevice.legacyIdentifiers?.dmsIdentifier?.deviceType?.value?.text;
		
		if (!deviceSerial || !deviceType) {
			console.warn("Missing serial number or device type for Echo device");
			return null;
		}
		
		console.log("Music: Using Echo device:", {
			serialNumber: deviceSerial,
			deviceType: deviceType,
			friendlyName: echoDevice.friendlyName
		});
	} catch (error) {
		console.warn("Failed to get Echo device from GraphQL:", error);
		return null;
	}

	const npUrl = `https://alexa.amazon.com/api/np/list-media-sessions?deviceSerialNumber=${deviceSerial}&deviceType=${deviceType}`;
	console.log("Music: Fetching from URL:", npUrl);

	const res = await fetch(npUrl, {
		headers: buildAlexaHeaders(env),
	});

	if (!res.ok) return null;

	type NPResponse = {
		mediaSessionList?: Array<{
			nowPlayingData?: {
				infoText?: {
					title?: string;
					subText1?: string; // artist
					subText2?: string; // album / mix
				};
				mainArt?: {
					mediumUrl?: string;
					largeUrl?: string;
					smallUrl?: string;
					tinyUrl?: string;
					fullUrl?: string;
				};
			};
		}>;
	};

	const data = (await res.json()) as NPResponse;
	const session = data.mediaSessionList?.[0];
	if (!session?.nowPlayingData) return null;

	const { infoText, mainArt } = session.nowPlayingData as any;
	const state =
		((session as any).playerState as string | undefined) ??
		(session.nowPlayingData as any)?.playerState;
	const progress = (session.nowPlayingData as any)?.progress as
		| { mediaLength?: number; mediaProgress?: number }
		| undefined;
	const providerName = ((session.nowPlayingData as any)?.provider?.providerName ?? "") as string;

	const provider: "spotify" | "amazon" = providerName.toLowerCase().includes("spotify")
		? "spotify"
		: "amazon";
	const isPlaying = state === "PLAYING";

	return {
		provider,
		isPlaying,
		trackName: infoText?.title ?? "",
		artist: infoText?.subText1 ?? "",
		album: infoText?.subText2 ?? "",
		coverUrl:
			mainArt?.mediumUrl ||
			mainArt?.largeUrl ||
			mainArt?.smallUrl ||
			mainArt?.tinyUrl ||
			mainArt?.fullUrl ||
			"",
		mediaLength: progress?.mediaLength,
		mediaProgress: progress?.mediaProgress,
	};
}
