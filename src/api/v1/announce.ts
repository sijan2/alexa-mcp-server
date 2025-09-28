import type { Context } from "hono";
import { type Env, EnvSchema } from "@/types/env";
import { buildAlexaHeaders, getAccountId, isAnyLightOn } from "@/utils/alexa";

export async function announceHandler(c: Context<{ Bindings: Env }>) {
	// Validate environment
	const env = EnvSchema.parse(c.env);
	const { UBID_MAIN, AT_MAIN } = env;

	if (!UBID_MAIN || !AT_MAIN) {
		return c.json({ error: "Missing UBID_MAIN or AT_MAIN in environment." }, 500);
	}

	let parsed: { name?: string; message?: string } = {};
	try {
		parsed = await c.req.json();
	} catch {
		return c.json({ error: "Invalid JSON body." }, 400);
	}

	const name = (parsed.name ?? "").trim();
	const message = (parsed.message ?? "").trim();

	if (!name || !message) {
		return c.json({ error: 'Both "name" and "message" are required.' }, 400);
	}
	if (name.length > 40) {
		return c.json({ error: "Name must be 40 characters or fewer." }, 400);
	}
	if (message.length > 145) {
		return c.json({ error: "Message must be 145 characters or fewer." }, 400);
	}

	// Determine whether it's day (10 ≤ hour < 22) or night in configured TZ
	const tz = env.TZ || "America/New_York";
	const now = new Date();
	const hourTz = Number(
		new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(
			now,
		),
	);
	const isDay = hourTz >= 10 && hourTz < 22;

	// At night we require any light to be ON, during the day we ignore light state
	if (!isDay) {
		const lightOn = await isAnyLightOn(env);
		if (lightOn === false) {
			return c.json(
				{ error: "All lights are off – announcement suppressed for night time." },
				403,
			);
		}
	}

	const announcement = {
		type: "announcement/text",
		messageText: message,
		senderFirstName: name,
		senderLastName: "",
		announcementPrefix: "",
	};

	// Get account ID dynamically
	const accountId = await getAccountId(env);

	const url = `https://alexa-comms-mobile-service.amazon.com/users/${accountId}/announcements`;

	const res = await fetch(url, {
		method: "POST",
		headers: buildAlexaHeaders(env, {
			"Content-Type": "application/json; charset=utf-8",
		}),
		body: JSON.stringify(announcement),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		return new Response(
			JSON.stringify({ error: "Alexa API error", status: res.status, body: text }),
			{
				status: res.status,
				headers: { "content-type": "application/json" },
			},
		);
	}

	type AlexaAnnounceResponse = {
		statuses?: Array<{ playbackStatus?: string; deliveredTime?: string }>;
	};

	const announceData = (await res.json().catch(() => ({}))) as AlexaAnnounceResponse;

	const firstStatus = announceData.statuses?.[0] ?? {};

	return c.json({
		playbackStatus: firstStatus.playbackStatus ?? null,
		deliveredTime: firstStatus.deliveredTime ?? null,
	});
}
