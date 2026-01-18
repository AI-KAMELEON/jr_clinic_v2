/**
 * Model Context Protocol (MCP) types and utilities
 * Standard protocol for AI agents to interact with tools
 */

import type { AgentTool } from "./agent-tools.ts";

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
}

/**
 * Converts agent tools to MCP format
 */
export function convertToMCPTools(agentTools: AgentTool[]): MCPTool[] {
  return agentTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  }));
}

/**
 * Creates MCP error response
 */
export function createMCPError(
  id: string | number,
  code: number,
  message: string,
  data?: any
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data && { data }),
    },
  };
}

/**
 * Creates MCP success response
 */
export function createMCPSuccess(
  id: string | number,
  result: any
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

/**
 * MCP Error Codes (JSON-RPC 2.0 standard)
 */
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom error codes
  UNAUTHORIZED: 401,
  RATE_LIMIT_EXCEEDED: 429,
  TOOL_EXECUTION_ERROR: -32000,
} as const;

/**
 * Validates MCP request structure
 */
export function validateMCPRequest(request: any): {
  valid: boolean;
  error?: string;
} {
  if (!request) {
    return { valid: false, error: "Request is required" };
  }

  if (request.jsonrpc !== "2.0") {
    return {
      valid: false,
      error: "Invalid jsonrpc version. Must be '2.0'",
    };
  }

  if (!request.method || typeof request.method !== "string") {
    return { valid: false, error: "Method is required and must be a string" };
  }

  // ID is optional for notifications (methods starting with "notifications/")
  // According to JSON-RPC 2.0 spec, notifications must not have an id
  if (!request.method.startsWith("notifications/")) {
    if (request.id === undefined || request.id === null) {
      return { valid: false, error: "Request id is required" };
    }
  }

  return { valid: true };
}

/**
 * Validates tool call parameters against schema
 */
export function validateToolParams(
  params: any,
  tool: MCPTool
): { valid: boolean; error?: string; missingParams?: string[] } {
  if (!params || typeof params !== "object") {
    return {
      valid: false,
      error: "Parameters must be an object",
    };
  }

  const required = tool.inputSchema.required || [];
  const missingParams: string[] = [];

  for (const paramName of required) {
    if (params[paramName] === undefined || params[paramName] === null) {
      missingParams.push(paramName);
    }
  }

  if (missingParams.length > 0) {
    return {
      valid: false,
      error: `Missing required parameters: ${missingParams.join(", ")}`,
      missingParams,
    };
  }

  // Type validation (basic)
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramSchema = tool.inputSchema.properties[paramName];
    if (paramSchema) {
      const expectedType = paramSchema.type;
      const actualType = typeof paramValue;

      // Basic type checking
      if (
        expectedType === "string" &&
        actualType !== "string" &&
        paramValue !== null &&
        paramValue !== undefined
      ) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be of type ${expectedType}, got ${actualType}`,
        };
      }

      if (
        expectedType === "number" &&
        actualType !== "number" &&
        paramValue !== null &&
        paramValue !== undefined
      ) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be of type ${expectedType}, got ${actualType}`,
        };
      }

      if (
        expectedType === "boolean" &&
        actualType !== "boolean" &&
        paramValue !== null &&
        paramValue !== undefined
      ) {
        return {
          valid: false,
          error: `Parameter '${paramName}' must be of type ${expectedType}, got ${actualType}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Finds tool by name from list of MCP tools
 */
export function findToolByName(
  tools: MCPTool[],
  toolName: string
): MCPTool | undefined {
  return tools.find((tool) => tool.name === toolName);
}

/**
 * Creates validation error response
 */
export function createValidationError(
  id: string | number,
  message: string,
  missingParams?: string[]
): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.INVALID_PARAMS,
    message,
    missingParams ? { missingParams } : undefined
  );
}

/**
 * Creates method not found error response
 */
export function createMethodNotFoundError(
  id: string | number,
  method: string
): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.METHOD_NOT_FOUND,
    `Method not found: ${method}`
  );
}

/**
 * Creates tool not found error response
 */
export function createToolNotFoundError(
  id: string | number,
  toolName: string
): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.METHOD_NOT_FOUND,
    `Unknown tool: ${toolName}`
  );
}

/**
 * Creates internal error response
 */
export function createInternalError(
  id: string | number,
  message: string,
  data?: any
): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.INTERNAL_ERROR,
    message,
    data
  );
}

/**
 * Creates unauthorized error response
 */
export function createUnauthorizedError(id: string | number): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.UNAUTHORIZED,
    "Unauthorized - Invalid API key"
  );
}

/**
 * Creates rate limit error response
 */
export function createRateLimitError(id: string | number): MCPResponse {
  return createMCPError(
    id,
    MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    "Rate limit exceeded. Please try again later."
  );
}

