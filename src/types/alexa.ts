import { z } from "zod";

// Environment validation schema
export const EnvSchema = z.object({
	ALEXA_COOKIES: z.string().min(1, "ALEXA_COOKIES is required"),
	API_KEY: z.string().optional(),
	TZ: z.string().optional(),
	SPOTIFY_TOKEN: z.string().optional(),
	SPOTIFY_CLIENT_ID: z.string().optional(),
	SPOTIFY_CLIENT_SECRET: z.string().optional(),
	SPOTIFY_REFRESH_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export interface TemperatureCapability {
	namespace: "Alexa.TemperatureSensor";
	name: "temperature";
	value: {
		value: number;
		scale: "CELSIUS" | "FAHRENHEIT";
	};
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface PowerStateCapability {
	namespace: "Alexa.PowerController";
	name: "powerState";
	value: "ON" | "OFF";
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface BrightnessCapability {
	namespace: "Alexa.BrightnessController";
	name: "brightness";
	value: number;
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface ColorTempCapability {
	namespace: "Alexa.ColorTemperatureController";
	name: "colorTemperatureInKelvin";
	value: number;
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface ColorPropertiesCapability {
	namespace: "Alexa.ColorPropertiesController";
	name: "colorProperties";
	value: {
		name: string;
		[key: string]: any;
	};
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface IlluminanceCapability {
	namespace: "Alexa.LightSensor";
	name: "illuminance";
	value: number;
	timeOfSample: string;
	uncertaintyInMilliseconds: number;
}

export interface DeviceState {
	entityId: string;
	entityType: string;
	capabilityStates: string[];
}

export interface BedroomResponse {
	temperature?: {
		celsius?: number;
		fahrenheit?: number;
		timeOfSample?: string;
	};
	illuminance?: {
		value: number;
		timeOfSample: string;
	};
	light?: {
		on: boolean;
		brightness: number;
		color?: string;
	};
	lastUpdate?: string;
}

export interface MusicResponse {
	isPlaying: boolean;
	trackName?: string;
	artist?: string;
	album?: string;
	coverUrl?: string;
	provider?: "spotify" | "amazon";
	mediaProgress?: number;
	mediaLength?: number;
	timeOfSample?: string;
	trackUrl?: string;
}

export interface WeatherResponse {
	temp?: number;
	feelsLike?: number;
	aqi?: number;
	skyCover?: number;
	icon?: string;
	isRaining?: boolean;
	nowcastText?: string;
	textForecast?: Array<{
		heading: string;
		body: string;
	}>;
	alerts?: any;
}

export interface LightStateResponse {
	id: string;
	name: string;
	on: boolean;
	brightness: number;
	color: {
		mode: "name" | "tempK" | "hex" | "hsv" | "unknown";
		value: string | number;
	};
	colorTempK?: number;
	supports: {
		power: boolean;
		brightness: boolean;
		color: boolean;
		colorTemperature: boolean;
	};
	lastUpdate: string;
}

export interface LightListResponse {
	lights: Array<{
		id: string;
		name: string;
		capabilities: string[];
	}>;
}

export interface AnnouncementResponse {
	playbackStatus?: string;
	deliveredTime?: string;
}
