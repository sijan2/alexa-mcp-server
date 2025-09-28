import { getCustomerSmartHomeEndpoints } from "@/utils/alexa-dynamic";

export const listSmartHomeDevicesSchema = {};

export async function listSmartHomeDevices(_args: Record<string, never>, ctx?: any) {
	if (!ctx?.env?.UBID_MAIN || !ctx?.env?.AT_MAIN) {
		return {
			content: [
				{
					type: "text" as const,
					text: "ERROR: Missing UBID_MAIN or AT_MAIN in environment.",
				},
			],
			isError: true,
		};
	}

	try {
		const endpoints = await getCustomerSmartHomeEndpoints(ctx.env);
		
		const devices = endpoints.map((endpoint: any) => ({
			endpointId: endpoint.endpointId,
			friendlyName: endpoint.friendlyName,
			category: endpoint.displayCategories?.primary?.value || "UNKNOWN",
			allCategories: endpoint.displayCategories?.all?.map((cat: any) => cat.value) || [],
			deviceType: endpoint.legacyIdentifiers?.dmsIdentifier?.deviceType?.value?.text,
			serialNumber: endpoint.legacyIdentifiers?.dmsIdentifier?.deviceSerialNumber?.value?.text,
			entityId: endpoint.legacyIdentifiers?.chrsIdentifier?.entityId,
			applianceId: endpoint.legacyAppliance?.applianceId,
			manufacturerName: endpoint.legacyAppliance?.manufacturerName,
			modelName: endpoint.legacyAppliance?.modelName,
			description: endpoint.legacyAppliance?.friendlyDescription,
			connectedVia: endpoint.legacyAppliance?.connectedVia,
			isEnabled: endpoint.legacyAppliance?.isEnabled,
			reachability: endpoint.legacyAppliance?.applianceNetworkState?.reachability,
			capabilities: endpoint.legacyAppliance?.capabilities?.map((cap: any) => cap.interfaceName) || [],
			lastSeen: endpoint.legacyAppliance?.applianceNetworkState?.lastSeenAt 
				? new Date(endpoint.legacyAppliance.applianceNetworkState.lastSeenAt).toISOString()
				: null,
		}));

		const summary = {
			totalDevices: devices.length,
			devicesByCategory: devices.reduce((acc: any, device: any) => {
				acc[device.category] = (acc[device.category] || 0) + 1;
				return acc;
			}, {}),
			onlineDevices: devices.filter((d: any) => d.reachability === "REACHABLE").length,
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							summary,
							devices,
							lastUpdate: new Date().toISOString(),
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
					text: `Failed to list smart home devices: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			],
			isError: true,
		};
	}
}