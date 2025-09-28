// MCP-specific types for tool responses and validation

export interface ToolResult {
	content: Array<{
		type: "text" | "image" | "resource";
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
}

export interface ToolArgs {
	[key: string]: any;
}

export interface ResourceResponse {
	contents: Array<{
		type: "text" | "image" | "resource";
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
}

export interface PromptResponse {
	messages: Array<{
		role: "user" | "assistant";
		content: {
			type: "text" | "image";
			text?: string;
			data?: string;
			mimeType?: string;
		};
	}>;
}
