import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Send email via SMTP
async function sendEmailViaSMTP(
  account: any,
  to: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const client = new SmtpClient();
    
    await client.connect({
      hostname: account.smtp_host,
      port: account.smtp_port,
      username: account.smtp_username,
      password: account.smtp_password_encrypted, // TODO: Decrypt from Vault
      tls: account.smtp_secure,
    });

    const recipients = [to];
    if (cc) recipients.push(...cc);
    if (bcc) recipients.push(...bcc);

    const result = await client.send({
      from: account.email_address,
      to: [to],
      cc: cc || [],
      subject: subject,
      content: bodyHtml || bodyText,
      html: bodyHtml || undefined,
    });

    await client.close();

    return { success: true, messageId: result.messageId || "unknown" };
  } catch (error: any) {
    console.error("SMTP error:", error);
    return { success: false, error: error.message };
  }
}

// Send email via Gmail API (OAuth2)
async function sendEmailViaGmail(
  account: any,
  to: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accessToken = account.oauth2_access_token_encrypted; // TODO: Decrypt from Vault
    
    // Create email message in RFC 2822 format
    const messageParts = [
      `From: ${account.email_address}`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc.join(", ")}`] : []),
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      bodyHtml || bodyText,
    ];

    const message = messageParts.join("\n");
    const encodedMessage = btoa(message)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: encodedMessage,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Gmail API error");
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error: any) {
    console.error("Gmail API error:", error);
    return { success: false, error: error.message };
  }
}

// Send email via Outlook/Microsoft Graph API (OAuth2)
async function sendEmailViaOutlook(
  account: any,
  to: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string,
  cc?: string[],
  bcc?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accessToken = account.oauth2_access_token_encrypted; // TODO: Decrypt from Vault

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            from: {
              emailAddress: {
                address: account.email_address,
              },
            },
            toRecipients: [{ emailAddress: { address: to } }],
            ...(cc && cc.length > 0
              ? {
                  ccRecipients: cc.map((email) => ({
                    emailAddress: { address: email },
                  })),
                }
              : {}),
            subject: subject,
            body: {
              contentType: bodyHtml ? "HTML" : "Text",
              content: bodyHtml || bodyText,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Microsoft Graph API error");
    }

    return { success: true, messageId: "outlook-" + Date.now() };
  } catch (error: any) {
    console.error("Outlook API error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      email_account_id,
      to,
      subject,
      body_text,
      body_html,
      cc,
      bcc,
      pacjent_id,
      wizyta_id,
    } = body;

    // Validate required fields
    if (!email_account_id || !to || !subject || !body_text) {
      return new Response(
        JSON.stringify({
          error: "email_account_id, to, subject, and body_text are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email account
    const account = await getEmailAccount(email_account_id);

    // Determine sending method
    let result;
    if (account.auth_type === "oauth2") {
      if (account.provider === "gmail") {
        result = await sendEmailViaGmail(
          account,
          to,
          subject,
          body_text,
          body_html,
          cc,
          bcc
        );
      } else if (account.provider === "outlook") {
        result = await sendEmailViaOutlook(
          account,
          to,
          subject,
          body_text,
          body_html,
          cc,
          bcc
        );
      } else {
        throw new Error("OAuth2 not supported for this provider");
      }
    } else if (account.auth_type === "smtp") {
      result = await sendEmailViaSMTP(
        account,
        to,
        subject,
        body_text,
        body_html,
        cc,
        bcc
      );
    } else {
      throw new Error("Unsupported auth type");
    }

    // Log email
    const logData: any = {
      email_account_id,
      pacjent_id: pacjent_id || null,
      wizyta_id: wizyta_id || null,
      to,
      cc: cc || null,
      bcc: bcc || null,
      subject,
      body_text,
      body_html: body_html || null,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      message_id: result.messageId || null,
      sent_at: result.success ? new Date().toISOString() : null,
    };

    const { error: logError } = await supabase
      .from("email_logs")
      .insert(logData);

    if (logError) {
      console.error("Error logging email:", logError);
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Failed to send email",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        message_id: result.messageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-email:", error);
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





