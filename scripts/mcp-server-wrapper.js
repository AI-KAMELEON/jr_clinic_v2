#!/usr/bin/env node
/**
 * MCP Server Wrapper for Cursor/KiloCode
 * Proxy between stdio MCP protocol and HTTP Supabase Edge Function
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const MCP_SERVER_URL = `${SUPABASE_URL}/functions/v1/mcp-server`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

// Read from stdin (MCP protocol)
process.stdin.setEncoding("utf8");

let buffer = "";

process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  
  // Process complete JSON-RPC messages
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      await handleMCPRequest(line.trim());
    }
  }
});

process.stdin.on("end", () => {
  if (buffer.trim()) {
    handleMCPRequest(buffer.trim());
  }
});

async function handleMCPRequest(requestLine) {
  try {
    const request = JSON.parse(requestLine);
    
    // Handle MCP initialize request
    if (request.method === "initialize") {
      const initResponse = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "clinic-voice-agent",
            version: "1.0.0"
          }
        }
      };
      console.log(JSON.stringify(initResponse));
      return;
    }
    
    if (request.method === "initialized") {
      // No response needed for initialized notification
      return;
    }
    
    // Forward all other requests to Supabase Edge Function
    const response = await fetch(MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();
    
    // Write response to stdout (MCP protocol)
    console.log(JSON.stringify(responseData));
  } catch (error) {
    // Send error response
    let responseId = "parse-error";
    try {
      const parsed = JSON.parse(requestLine);
      if (parsed && (typeof parsed.id === "string" || typeof parsed.id === "number")) {
        responseId = parsed.id;
      }
    } catch (_) {
      responseId = "parse-error";
    }

    const errorResponse = {
      jsonrpc: "2.0",
      id: responseId,
      error: {
        code: -32700,
        message: `Parse error: ${error?.message || String(error)}`,
      },
    };
    console.log(JSON.stringify(errorResponse));
  }
}

// Handle process termination
process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

