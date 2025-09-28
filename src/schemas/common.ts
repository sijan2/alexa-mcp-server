import { z } from "zod";

// Common validation schemas used across tools

export const lightIdSchema = z
	.string()
	.describe("Light entity ID (use 'b34d9c5a-b511-478c-b79a-bbfb0f21442d' for bedroom light)");

export const transitionTimeSchema = z
	.number()
	.min(0)
	.max(10000)
	.optional()
	.describe("Transition time in milliseconds (0-10000)");

export const brightnessLevelSchema = z
	.union([z.number(), z.string()])
	.transform((val) => {
		const num = typeof val === "string" ? Number.parseInt(val, 10) : val;
		return Math.max(0, Math.min(100, num));
	})
	.describe("Brightness level (0-100)");

export const colorModeSchema = z
	.enum(["name", "hex", "hsv", "tempK"])
	.describe(
		"Color mode: 'name' for color names, 'hex' for hex codes, 'hsv' for HSV values, 'tempK' for Kelvin temperature",
	);

export const colorValueSchema = z
	.union([
		z.string(), // For color names and hex codes
		z.number(), // For Kelvin temperature
		z.object({ h: z.number(), s: z.number(), v: z.number() }), // For HSV
	])
	.describe(
		"Color value based on mode - string for names/hex, number for Kelvin, object {h,s,v} for HSV",
	);

export const ssmlSchema = z
	.boolean()
	.optional()
	.describe("Whether the message contains SSML markup for advanced speech synthesis");

// Environment type for validation
export const envSchema = z.object({
	API_BASE: z.string().optional(),
	ALEXA_COOKIES: z.string().optional(),
});

export type EnvType = z.infer<typeof envSchema>;
