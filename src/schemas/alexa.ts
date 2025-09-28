import { z } from "zod";

// Device entity schema
export const DeviceEntitySchema = z.object({
	entityId: z.string(),
	entityType: z.string(),
	deviceName: z.string().optional(),
	friendlyName: z.string().optional(),
});

// Smart home device schema (from GraphQL favorites)
export const SmartHomeDeviceSchema = z.object({
	resource: z.object({
		id: z.string(),
		__typename: z.string(),
	}),
	favoriteFriendlyName: z.string(),
	displayInfo: z
		.object({
			displayCategories: z.object({
				primary: z.object({
					isCustomerSpecified: z.boolean(),
					isDiscovered: z.boolean(),
					value: z.string(),
					sources: z.array(z.string()),
					__typename: z.string(),
				}),
				all: z.array(
					z.object({
						isCustomerSpecified: z.boolean(),
						isDiscovered: z.boolean(),
						value: z.string(),
						sources: z.array(z.string()),
						__typename: z.string(),
					}),
				),
				__typename: z.string(),
			}),
			__typename: z.string(),
		})
		.nullable(),
	alternateIdentifiers: z
		.object({
			legacyIdentifiers: z.object({
				chrsIdentifier: z.object({
					entityId: z.string(),
					__typename: z.string(),
				}),
				dmsIdentifier: z.object({
					deviceSerialNumber: z.object({
						type: z.string(),
						value: z.object({
							text: z.string(),
							__typename: z.string(),
						}),
						__typename: z.string(),
					}),
					deviceType: z.object({
						type: z.string(),
						value: z.object({
							text: z.string(),
							__typename: z.string(),
						}),
						__typename: z.string(),
					}),
					__typename: z.string(),
				}),
				__typename: z.string(),
			}),
			__typename: z.string(),
		})
		.nullable(),
	type: z.string(),
	rank: z.number(),
	active: z.boolean(),
	variant: z.string(),
	__typename: z.string(),
});

// Phoenix state response schema
export const PhoenixStateResponseSchema = z.object({
	deviceStates: z.array(
		z.object({
			entity: z.object({
				entityId: z.string(),
				entityType: z.string(),
			}),
			capabilityStates: z.array(
				z.object({
					name: z.string(),
					namespace: z.string(),
					value: z.any(),
					timeOfSample: z.string(),
					uncertaintyInMilliseconds: z.number(),
				}),
			),
		}),
	),
});

// Account info schema (from alexa-comms-mobile-service)
export const AccountInfoSchema = z.array(
	z.object({
		commsId: z.string(),
		directedId: z.string(), // This is the customerId we need
		phoneCountryCode: z.string().optional(),
		phoneNumber: z.string().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		phoneticFirstName: z.string().nullable().optional(),
		phoneticLastName: z.string().nullable().optional(),
		commsProvisionStatus: z.string(),
		isChild: z.boolean(),
		personIdV2: z.string().optional(),
		mapDirectedDefaultActorId: z.string().nullable().optional(),
		phoneNumberMetadataForTheActor: z.any().nullable().optional(),
		signedInUser: z.boolean(),
		commsProvisioned: z.boolean(),
		enrolledInAlexa: z.boolean(),
		speakerProvisioned: z.boolean(),
	}),
);

// Smart home favorites schema (from GraphQL)
export const SmartHomeFavoritesSchema = z.object({
	data: z.object({
		favorites: z.object({
			favorites: z.array(SmartHomeDeviceSchema),
		}),
	}),
});

// Endpoints discovery schema
export const EndpointsDiscoverySchema = z.object({
	endpoints: z.array(
		z.object({
			endpointId: z.string(),
			friendlyName: z.string(),
			displayCategories: z.array(z.string()),
			capabilities: z.array(
				z.object({
					type: z.string(),
					interface: z.string(),
					version: z.string(),
					properties: z
						.object({
							supported: z
								.array(
									z.object({
										name: z.string(),
									}),
								)
								.optional(),
							proactivelyReported: z.boolean().optional(),
							retrievable: z.boolean().optional(),
						})
						.optional(),
				}),
			),
			manufacturerName: z.string().optional(),
			description: z.string().optional(),
		}),
	),
});

// Phoenix devices schema
export const PhoenixDevicesSchema = z.object({
	devices: z.array(
		z.object({
			entityId: z.string(),
			entityType: z.string(),
			applianceTypes: z.array(z.string()).optional(),
			friendlyName: z.string().optional(),
			manufacturerName: z.string().optional(),
			modelName: z.string().optional(),
			version: z.string().optional(),
			capabilities: z
				.array(
					z.object({
						capabilityType: z.string(),
						type: z.string(),
						version: z.string(),
					}),
				)
				.optional(),
		}),
	),
});

// Light control schemas
export const LightStateSchema = z.object({
	on: z.boolean(),
	brightness: z.number().min(0).max(100).optional(),
	color: z
		.object({
			hue: z.number().min(0).max(360).optional(),
			saturation: z.number().min(0).max(1).optional(),
			brightness: z.number().min(0).max(1).optional(),
		})
		.optional(),
	colorTemperatureInKelvin: z.number().min(2200).max(6500).optional(),
});

export const SetLightPowerSchema = z.object({
	id: z
		.string()
		.optional()
		.describe("Light ID (optional - if you have only one light, it will be auto-detected)"),
	on: z.boolean().describe("Whether to turn the light on (true) or off (false)"),
	transitionMs: z
		.number()
		.min(0)
		.max(10000)
		.optional()
		.describe("Transition time in milliseconds (0-10000)"),
});

export const SetLightBrightnessSchema = z.object({
	id: z
		.string()
		.optional()
		.describe("Light ID (optional - if you have only one light, it will be auto-detected)"),
	level: z.number().min(0).max(100).describe("Brightness level from 0-100%"),
	transitionMs: z
		.number()
		.min(0)
		.max(10000)
		.optional()
		.describe("Transition time in milliseconds (0-10000)"),
});

export const SetLightColorSchema = z.object({
	id: z
		.string()
		.optional()
		.describe("Light ID (optional - if you have only one light, it will be auto-detected)"),
	mode: z
		.enum(["name", "tempK"])
		.describe("Color mode: 'name' for color names or 'tempK' for Kelvin temperature"),
	value: z
		.union([
			z
				.enum([
					// White colors
					"warm_white",
					"soft_white",
					"white",
					"daylight_white",
					"cool_white",
					// Actual colors
					"red",
					"crimson",
					"salmon",
					"orange",
					"gold",
					"yellow",
					"green",
					"turquoise",
					"cyan",
					"sky_blue",
					"blue",
					"purple",
					"magenta",
					"pink",
					"lavender",
				])
				.describe("Color name"),
			z.number().min(2200).max(6500).describe("Color temperature in Kelvin (2200-6500)"),
		])
		.describe("Color value: either a color name or Kelvin temperature number"),
	transitionMs: z
		.number()
		.min(0)
		.max(10000)
		.optional()
		.describe("Transition time in milliseconds (0-10000)"),
});

// Announcement schema
export const AlexaAnnounceSchema = z.object({
	name: z.string().describe("Target device name or 'everywhere' for all devices"),
	message: z.string().describe("The message to announce"),
});

// Weather schema
export const WeatherSchema = z.object({
	temperature: z.number(),
	condition: z.string(),
	humidity: z.number().optional(),
	airQuality: z
		.object({
			index: z.number(),
			category: z.string(),
		})
		.optional(),
});

// Music status schema
export const MusicStatusSchema = z.object({
	isPlaying: z.boolean(),
	title: z.string().optional(),
	artist: z.string().optional(),
	album: z.string().optional(),
	device: z.string().optional(),
});

// Bedroom state schema
export const BedroomStateSchema = z.object({
	temperature: z.number().optional(),
	illuminance: z.number().optional(),
	lightOn: z.boolean(),
	deviceStates: z.array(
		z.object({
			entityId: z.string(),
			name: z.string(),
			value: z.any(),
			timestamp: z.string(),
		}),
	),
});

// Volume schemas
export const DeviceVolumeSchema = z.object({
	alertVolume: z.number().nullable(),
	deviceType: z.string(),
	dsn: z.string(),
	error: z.string().nullable(),
	speakerMuted: z.boolean(),
	speakerVolume: z.number(),
});

export const AllDeviceVolumesSchema = z.object({
	volumes: z.array(DeviceVolumeSchema),
});

export const SetVolumeSchema = z.object({
	deviceType: z.string().optional().describe("Device type (optional - if you have only one device, it will be auto-detected)"),
	dsn: z.string().optional().describe("Device serial number (optional - if you have only one device, it will be auto-detected)"),
	volume: z.number().min(0).max(100).describe("Volume level from 0-100"),
});

export const AdjustVolumeSchema = z.object({
	deviceType: z.string().optional().describe("Device type (optional - if you have only one device, it will be auto-detected)"),
	dsn: z.string().optional().describe("Device serial number (optional - if you have only one device, it will be auto-detected)"),
	amount: z.number().min(-100).max(100).describe("Volume adjustment amount (-100 to +100)"),
});

// Type exports using schema inference
export type DeviceEntity = z.infer<typeof DeviceEntitySchema>;
export type SmartHomeDevice = z.infer<typeof SmartHomeDeviceSchema>;
export type PhoenixStateResponse = z.infer<typeof PhoenixStateResponseSchema>;
export type AccountInfo = z.infer<typeof AccountInfoSchema>;
export type SmartHomeFavorites = z.infer<typeof SmartHomeFavoritesSchema>;
export type EndpointsDiscovery = z.infer<typeof EndpointsDiscoverySchema>;
export type PhoenixDevices = z.infer<typeof PhoenixDevicesSchema>;
export type LightState = z.infer<typeof LightStateSchema>;
export type SetLightPowerInput = z.infer<typeof SetLightPowerSchema>;
export type SetLightBrightnessInput = z.infer<typeof SetLightBrightnessSchema>;
export type SetLightColorInput = z.infer<typeof SetLightColorSchema>;
export type AlexaAnnounceInput = z.infer<typeof AlexaAnnounceSchema>;
export type Weather = z.infer<typeof WeatherSchema>;
export type MusicStatus = z.infer<typeof MusicStatusSchema>;
export type BedroomState = z.infer<typeof BedroomStateSchema>;
export type DeviceVolume = z.infer<typeof DeviceVolumeSchema>;
export type AllDeviceVolumes = z.infer<typeof AllDeviceVolumesSchema>;
export type SetVolumeInput = z.infer<typeof SetVolumeSchema>;
export type AdjustVolumeInput = z.infer<typeof AdjustVolumeSchema>;
