import {
	AccountInfoSchema,
	EndpointsDiscoverySchema,
	PhoenixDevicesSchema,
	SmartHomeFavoritesSchema,
} from "@/schemas/alexa";
import type { Env } from "@/types/alexa";
import { buildAlexaHeaders } from "@/utils/alexa";

// Cache for dynamic values to avoid repeated API calls
const cache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.value as T;
	}
	return null;
}

function setCache(key: string, value: any) {
	cache.set(key, { value, timestamp: Date.now() });
}

// Fetch account information dynamically
export async function getAccountInfo(env: Env) {
	const cacheKey = "account_info";
	const cached = getCached<{ customerId: string; profiles: any[] }>(cacheKey);
	if (cached) return cached;

	const response = await fetch("https://alexa-comms-mobile-service.amazon.com/accounts", {
		method: "GET",
		headers: buildAlexaHeaders(env),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch account info: ${response.status}`);
	}

	const data = await response.json();
	const validatedData = AccountInfoSchema.parse(data);

	// Get the first account (should be the signed-in user)
	const primaryAccount =
		validatedData.find((account) => account.signedInUser) || validatedData[0];

	if (!primaryAccount) {
		throw new Error("No account found in response");
	}

	const accountInfo = {
		customerId: primaryAccount.directedId,
		profiles: [], // Not available in this simpler endpoint
	};

	setCache(cacheKey, accountInfo);
	return accountInfo;
}

// Fetch all Alexa devices/endpoints
export async function getAlexaEndpoints(env: Env) {
	const cacheKey = "alexa_endpoints";
	const cached = getCached<any[]>(cacheKey);
	if (cached) return cached;

	const response = await fetch("https://alexa.amazon.com/api/smarthome/v2/endpoints", {
		method: "POST",
		headers: buildAlexaHeaders(env, {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-cache",
		}),
		body: JSON.stringify({ endpointContexts: ["GROUP"] }),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch endpoints: ${response.status}`);
	}

	const data = await response.json();
	const validatedData = EndpointsDiscoverySchema.parse(data);
	setCache(cacheKey, validatedData.endpoints);
	return validatedData.endpoints;
}

// Fetch registered devices
export async function getAlexaDevices(env: Env) {
	const cacheKey = "alexa_devices";
	const cached = getCached<any[]>(cacheKey);
	if (cached) return cached;

	const response = await fetch("https://alexa.amazon.com/api/devices-v2/device?cached=true", {
		method: "GET",
		headers: buildAlexaHeaders(env, {
			Accept: "application/json; charset=utf-8",
			"Cache-Control": "no-cache",
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch devices: ${response.status}`);
	}

	const data = await response.json();
	const validatedData = PhoenixDevicesSchema.parse(data);
	setCache(cacheKey, validatedData.devices);
	return validatedData.devices;
}

// Get primary Echo device for announcements
export async function getPrimaryEchoDevice(env: Env) {
	const devices = await getAlexaDevices(env);

	// Look for Echo devices (ECHO family)
	const echoDevices = devices.filter(
		(device: any) => device.deviceFamily === "ECHO" && device.online,
	);

	if (echoDevices.length === 0) {
		throw new Error("No online Echo devices found");
	}

	// Return the first available Echo device
	return echoDevices[0];
}

// Get primary smart home device for media queries
export async function getPrimaryMediaDevice(env: Env) {
	const devices = await getAlexaDevices(env);

	// Look for devices that support media capabilities
	const mediaDevices = devices.filter(
		(device: any) => device.capabilities?.includes("AUDIO_PLAYER") && device.online,
	);

	if (mediaDevices.length === 0) {
		// Fallback to any online device
		const onlineDevices = devices.filter((device: any) => device.online);
		if (onlineDevices.length === 0) {
			throw new Error("No online devices found");
		}
		return onlineDevices[0];
	}

	return mediaDevices[0];
}

// Get favorites (main smart home devices) - more reliable than endpoints
export async function getSmartHomeFavorites(env: Env) {
	const cacheKey = "smart_home_favorites";
	const cached = getCached<any[]>(cacheKey);
	if (cached) return cached;

	const query = `
    fragment FavoriteMetadata on Favorite {
      resource {
        id
        __typename
      }
      favoriteFriendlyName
      displayInfo {
        displayCategories {
          primary {
            isCustomerSpecified
            isDiscovered
            value
            sources
            __typename
          }
          all {
            isCustomerSpecified
            isDiscovered
            value
            sources
            __typename
          }
          __typename
        }
        __typename
      }
      alternateIdentifiers {
        legacyIdentifiers {
          chrsIdentifier {
            entityId
            __typename
          }
          dmsIdentifier {
            deviceSerialNumber {
              type
              value {
                text
                __typename
              }
              __typename
            }
            deviceType {
              type
              value {
                text
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      type
      rank
      active
      variant
      __typename
    }

    query ListFavoritesForHomeChannel($requestedTypes: [String!]) {
      favorites(listFavoritesInput: {requestedTypes: $requestedTypes}) {
        favorites {
          ...FavoriteMetadata
          __typename
        }
        __typename
      }
    }
  `;

	const response = await fetch("https://alexa.amazon.com/nexus/v1/graphql", {
		method: "POST",
		headers: buildAlexaHeaders(env, {
			"Content-Type": "application/json",
			"X-Amzn-Marketplace-Id": "ATVPDKIKX0DER",
			"X-Amzn-Client": "AlexaApp",
			"X-Amzn-Os-Name": "android",
		}),
		body: JSON.stringify({
			operationName: "ListFavoritesForHomeChannel",
			variables: {
				requestedTypes: [
					"AEA",
					"ALEXA_LIST",
					"AWAY_LIGHTING",
					"DEVICE_SHORTCUT",
					"DTG",
					"ENDPOINT",
					"SHORTCUT",
					"STATIC_ENTERTAINMENT",
				],
			},
			query,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch favorites: ${response.status}`);
	}

	const data = await response.json();
	const validatedData = SmartHomeFavoritesSchema.parse(data);
	const favorites = validatedData.data.favorites.favorites;

	setCache(cacheKey, favorites);
	return favorites;
}

// Find smart home entities (lights, sensors, etc.) using favorites API
export async function getSmartHomeEntities(env: Env) {
	const favorites = await getSmartHomeFavorites(env);

	// Filter for active smart home devices
	const smartHomeDevices = favorites.filter((favorite: any) => {
		return favorite.active && favorite.type === "ENDPOINT";
	});

	return smartHomeDevices;
}

// Get the primary light entity dynamically (first available light)
export async function getPrimaryLight(env: Env) {
	const smartHomeDevices = await getSmartHomeEntities(env);

	// Look for devices that are lights
	const lightDevices = smartHomeDevices.filter((device: any) => {
		const primaryCategory = device.displayInfo?.displayCategories?.primary?.value;
		return primaryCategory === "LIGHT";
	});

	if (lightDevices.length === 0) {
		throw new Error("No smart home light devices found");
	}

	// Return the first light device
	return lightDevices[0];
}

// Get all device entity IDs for state requests
export async function getAllDeviceEntityIds(env: Env) {
	const [endpoints, devices] = await Promise.all([getAlexaEndpoints(env), getAlexaDevices(env)]);

	const entityIds: Array<{ entityId: string; entityType: string }> = [];

	// Add Echo devices for temperature/illuminance sensors
	devices.forEach((device: any) => {
		if (device.online) {
			// Add bridge entities for Echo devices
			entityIds.push({
				entityId: `AlexaBridge_${device.serialNumber}@${device.deviceType}_${device.serialNumber}`,
				entityType: "APPLIANCE",
			});
		}
	});

	// Add smart home endpoints
	endpoints.forEach((endpoint: any) => {
		const entityId = endpoint.identifier?.entityId || endpoint.serialNumber;
		if (entityId) {
			entityIds.push({
				entityId,
				entityType: "APPLIANCE",
			});
		}
	});

	return entityIds;
}

// Get customer smart home endpoints using GraphQL
export async function getCustomerSmartHomeEndpoints(env: Env) {
	const cacheKey = "customer_smart_home_endpoints";
	const cached = getCached<any[]>(cacheKey);
	if (cached) return cached;

	const query = `
		query CustomerSmartHome {
			endpoints(
				endpointsQueryParams: { paginationParams: { disablePagination: true } }
			) {
				items {
					endpointId
					id
					friendlyName
					displayCategories {
						all {
							value
						}
						primary {
							value
						}
					}
					legacyIdentifiers {
						chrsIdentifier {
							entityId
						}
						dmsIdentifier {
							deviceType {
								type
								value {
									text
								}
							}
							deviceSerialNumber {
								type
								value {
									text
								}
							}
						}
					}
					legacyAppliance {
						applianceId
						applianceTypes
						friendlyName
						entityId
						mergedApplianceIds
						capabilities
					}
				}
			}
		}
	`;

	const response = await fetch("https://alexa.amazon.com/nexus/v1/graphql", {
		method: "POST",
		headers: buildAlexaHeaders(env, {
			"Content-Type": "application/json",
			"X-Amzn-Marketplace-Id": "ATVPDKIKX0DER",
			"X-Amzn-Client": "AlexaApp",
			"X-Amzn-Os-Name": "android",
		}),
		body: JSON.stringify({ query }),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch customer smart home endpoints: ${response.status}`);
	}

	const data = (await response.json()) as any;
	const endpoints = data.data?.endpoints?.items || [];

	setCache(cacheKey, endpoints);
	return endpoints;
}

// Get Echo device entity ID for sensors (temperature, illuminance)
export async function getEchoDeviceEntityId(env: Env): Promise<string> {
	const endpoints = await getCustomerSmartHomeEndpoints(env);

	// Find Echo device (ALEXA_VOICE_ENABLED category)
	const echoDevice = endpoints.find((endpoint: any) => {
		const primaryCategory = endpoint.displayCategories?.primary?.value;
		return primaryCategory === "ALEXA_VOICE_ENABLED";
	});

	if (!echoDevice) {
		throw new Error("No Echo device found for sensors");
	}

	// For sensor data, we need the entity ID, not appliance ID
	return echoDevice.legacyIdentifiers?.chrsIdentifier?.entityId || echoDevice.entityId;
}

// Get light appliance ID for state requests (different from entity ID)
export async function getLightApplianceId(env: Env): Promise<string> {
	const endpoints = await getCustomerSmartHomeEndpoints(env);

	// Find light device
	const lightDevice = endpoints.find((endpoint: any) => {
		const primaryCategory = endpoint.displayCategories?.primary?.value;
		return primaryCategory === "LIGHT";
	});

	if (!lightDevice) {
		throw new Error("No light device found");
	}

	// Return the appliance ID from legacyAppliance
	return lightDevice.legacyAppliance?.applianceId;
}

// Helper to extract entity ID from smart home device
export function extractEntityId(device: any): string {
	// For favorites API response, entity ID is in alternateIdentifiers
	if (device.alternateIdentifiers?.legacyIdentifiers?.chrsIdentifier?.entityId) {
		return device.alternateIdentifiers.legacyIdentifiers.chrsIdentifier.entityId;
	}

	// For other API responses, check identifier
	if (device.identifier?.entityId) {
		return device.identifier.entityId;
	}

	// Extract from resource.id if available (favorites format)
	if (device.resource?.id?.includes("endpoint.")) {
		return device.resource.id.replace("amzn1.alexa.endpoint.", "");
	}

	// Fallback to serial number
	return device.serialNumber || device.resource?.id;
}

// Helper to build endpoint ID from entity ID
export function buildEndpointId(entityId: string): string {
	if (entityId.startsWith("amzn1.alexa.endpoint.")) {
		return entityId;
	}
	return `amzn1.alexa.endpoint.${entityId}`;
}
