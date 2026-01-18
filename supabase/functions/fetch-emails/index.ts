import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper: Get email account
async function getEmailAccount(accountId: string): Promise<any> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("Email account not found or inactive");
  }

  return data;
}

// Fetch emails via Gmail API
async function fetchEmailsViaGmail(
  account: any,
  maxResults: number = 50
): Promise<any[]> {
  try {
    const accessToken = account.oauth2_access_token_encrypted; // TODO: Decrypt from Vault

    // Get message list
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error("Failed to fetch message list");
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];

    // Fetch full message details
    const emails = [];
    for (const msg of messages.slice(0, maxResults)) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const payload = msgData.payload;

        // Parse headers
        const headers = payload.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
            ?.value || "";

        // Parse body
        let bodyText = "";
        let bodyHtml = "";

        if (payload.body?.data) {
          bodyText = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        }

        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
              bodyText = atob(
                part.body.data.replace(/-/g, "+").replace(/_/g, "/")
              );
            }
            if (part.mimeType === "text/html" && part.body?.data) {
              bodyHtml = atob(
                part.body.data.replace(/-/g, "+").replace(/_/g, "/")
              );
            }
          }
        }

        emails.push({
          message_id: msgData.id,
          from_email: getHeader("From"),
          from_name: getHeader("From").match(/^(.+?)\s*<|^(.+)$/)?.[1] || getHeader("From"),
          to: getHeader("To").split(",").map((e: string) => e.trim()),
          cc: getHeader("Cc") ? getHeader("Cc").split(",").map((e: string) => e.trim()) : [],
          subject: getHeader("Subject"),
          body_text: bodyText,
          body_html: bodyHtml,
          received_at: new Date(parseInt(msgData.internalDate)).toISOString(),
          has_attachments: payload.parts?.some((p: any) => p.filename) || false,
        });
      } catch (err) {
        console.error(`Error fetching message ${msg.id}:`, err);
      }
    }

    return emails;
  } catch (error: any) {
    console.error("Gmail API error:", error);
    throw error;
  }
}

// Fetch emails via Microsoft Graph API (Outlook)
async function fetchEmailsViaOutlook(
  account: any,
  maxResults: number = 50
): Promise<any[]> {
  try {
    const accessToken = account.oauth2_access_token_encrypted; // TODO: Decrypt from Vault

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=${maxResults}&$orderby=receivedDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch emails from Outlook");
    }

    const data = await response.json();
    const messages = data.value || [];

    return messages.map((msg: any) => ({
      message_id: msg.id,
      from_email: msg.from?.emailAddress?.address || "",
      from_name: msg.from?.emailAddress?.name || "",
      to: msg.toRecipients?.map((r: any) => r.emailAddress.address) || [],
      cc: msg.ccRecipients?.map((r: any) => r.emailAddress.address) || [],
      subject: msg.subject || "",
      body_text: msg.bodyPreview || "",
      body_html: msg.body?.content || "",
      received_at: msg.receivedDateTime,
      has_attachments: msg.hasAttachments || false,
    }));
  } catch (error: any) {
    console.error("Outlook API error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // GET - Fetch emails
    if (req.method === "GET") {
      const url = new URL(req.url);
      const accountId = url.searchParams.get("email_account_id");
      const maxResults = parseInt(url.searchParams.get("maxResults") || "50");

      if (!accountId) {
        return new Response(
          JSON.stringify({ error: "email_account_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const account = await getEmailAccount(accountId);

      let emails;
      if (account.provider === "gmail" && account.auth_type === "oauth2") {
        emails = await fetchEmailsViaGmail(account, maxResults);
      } else if (account.provider === "outlook" && account.auth_type === "oauth2") {
        emails = await fetchEmailsViaOutlook(account, maxResults);
      } else {
        return new Response(
          JSON.stringify({
            error: "Email fetching not supported for this account type",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save emails to database
      const emailsToInsert = emails.map((email) => ({
        email_account_id: accountId,
        message_id: email.message_id,
        from_email: email.from_email,
        from_name: email.from_name,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body_text: email.body_text,
        body_html: email.body_html,
        received_at: email.received_at,
        has_attachments: email.has_attachments,
      }));

      // Use upsert to avoid duplicates
      const { error: insertError } = await supabase
        .from("email_inbox")
        .upsert(emailsToInsert, {
          onConflict: "email_account_id,message_id",
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error("Error saving emails:", insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          emails: emails,
          count: emails.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Mark email as read
    if (req.method === "POST") {
      const body = await req.json();
      const { email_id, is_read } = body;

      if (!email_id || typeof is_read !== "boolean") {
        return new Response(
          JSON.stringify({ error: "email_id and is_read (boolean) are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("email_inbox")
        .update({ is_read: is_read })
        .eq("id", email_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, email: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in fetch-emails:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});





