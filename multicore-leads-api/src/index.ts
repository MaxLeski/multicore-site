import { Resend } from "resend";

export interface Env {
  LEAD_FILES: R2Bucket;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  NOTIFICATION_EMAIL?: string;
  FROM_EMAIL?: string;
}

// Dozwolone rozszerzenia plików (whitelist)
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "pdf",
  "stl", "step", "stp", "obj", "zip",
  "iges", "igs", "3mf", "rar", "7z"
]);

const MAX_FILES_COUNT = 10;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB per plik

/**
 * Zwraca nagłówki CORS w zależności od Origin żądania
 */
function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "";
  
  // Dozwolone domeny
  const isAllowedOrigin =
    origin === "https://multicore.net.pl" ||
    origin === "https://www.multicore.net.pl" ||
    origin.endsWith(".multicore.net.pl") ||
    origin.endsWith(".github.io") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin === "null"; // np. lokalne pliki file:// w testach

  const allowOrigin = isAllowedOrigin ? origin : "https://multicore.net.pl";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Weryfikacja tokenu Cloudflare Turnstile po stronie serwera
 */
async function verifyTurnstile(
  secret: string,
  token: string,
  clientIp?: string | null
): Promise<{ success: boolean; errorCodes?: string[] }> {
  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    return {
      success: data.success,
      errorCodes: data["error-codes"],
    };
  } catch (err) {
    console.error("Błąd podczas weryfikacji Turnstile:", err);
    return { success: false, errorCodes: ["network_error"] };
  }
}

/**
 * Bezpieczne oczyszczenie nazwy pliku (usuwa ścieżki i znaki specjalne)
 */
function sanitizeFilename(filename: string): string {
  // Pobierz samą nazwę bez ścieżki
  const base = filename.replace(/^.*[\\/]/, "");
  // Zamień spacje i polskie/specjalne znaki na bezpieczne
  const safe = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // usuń diakrytyki
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || `file_${Date.now()}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);
    const url = new URL(request.url);

    // Obsługa preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Prosty health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json(
        {
          status: "healthy",
          service: "multicore-leads-api",
          version: "1.0.0",
          r2Connected: !!env.LEAD_FILES,
          resendConfigured: !!env.RESEND_API_KEY,
          turnstileEnforced: !!env.TURNSTILE_SECRET,
        },
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Endpoint leadów
    if (url.pathname !== "/lead") {
      return Response.json(
        { success: false, error: "Not Found" },
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (request.method !== "POST") {
      return Response.json(
        { success: false, error: "Method Not Allowed" },
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const contentType = request.headers.get("Content-Type") || "";
      let name = "";
      let email = "";
      let phone = "";
      let company = "";
      let topic = "";
      let preferredContact = "";
      let message = "";
      let honeypot = "";
      let turnstileToken = "";
      let calcSummary = "";
      let utmSource = "";
      let utmMedium = "";
      let utmCampaign = "";
      const incomingFiles: File[] = [];

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();

        name = (formData.get("name") as string) || "";
        email = (formData.get("email") as string) || "";
        phone = (formData.get("phone") as string) || "";
        company = (formData.get("company") as string) || "";
        topic = (formData.get("topic") as string) || "";
        preferredContact = (formData.get("preferredContact") as string) || "";
        message = (formData.get("message") as string) || "";
        honeypot = (formData.get("company_fax_or_url") as string) || "";
        turnstileToken =
          (formData.get("cf-turnstile-response") as string) ||
          (formData.get("turnstileToken") as string) ||
          "";
        calcSummary =
          (formData.get("calc_summary") as string) ||
          (formData.get("calculatorData") as string) ||
          "";
        utmSource = (formData.get("utm_source") as string) || "";
        utmMedium = (formData.get("utm_medium") as string) || "";
        utmCampaign = (formData.get("utm_campaign") as string) || "";

        // Odczyt plików z formularza (zarówno 'files', 'files[]' jak i poszczególnych pól plikowych)
        for (const [key, value] of formData.entries()) {
          if (value instanceof File && value.size > 0 && value.name) {
            incomingFiles.push(value);
          }
        }
      } else if (contentType.includes("application/json")) {
        const body = (await request.json()) as Record<string, any>;
        name = body.name || "";
        email = body.email || "";
        phone = body.phone || "";
        company = body.company || "";
        topic = body.topic || "";
        preferredContact = body.preferredContact || "";
        message = body.message || "";
        honeypot = body.company_fax_or_url || "";
        turnstileToken = body["cf-turnstile-response"] || body.turnstileToken || "";
        calcSummary = typeof body.calc_summary === "object" ? JSON.stringify(body.calc_summary) : body.calc_summary || "";
        utmSource = body.utm_source || "";
        utmMedium = body.utm_medium || "";
        utmCampaign = body.utm_campaign || "";
      } else {
        return Response.json(
          { success: false, error: "Nieobsługiwany Content-Type. Użyj multipart/form-data lub application/json." },
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Honeypot check (ciche odrzucenie spamu bez błędu)
      if (honeypot.trim()) {
        console.warn("Honeypot triggered:", honeypot);
        return Response.json(
          { success: true, leadId: crypto.randomUUID(), message: "Zapytanie przyjęte." },
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Weryfikacja Cloudflare Turnstile (jeśli skonfigurowano sekret)
      if (env.TURNSTILE_SECRET) {
        if (!turnstileToken) {
          return Response.json(
            { success: false, error: "Brak tokena weryfikacji Turnstile (ochrona anty-bot)." },
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const clientIp = request.headers.get("CF-Connecting-IP");
        const verification = await verifyTurnstile(env.TURNSTILE_SECRET, turnstileToken, clientIp);

        if (!verification.success) {
          console.warn("Nieudana weryfikacja Turnstile:", verification.errorCodes);
          return Response.json(
            { success: false, error: "Weryfikacja anty-bot nie powiodła się. Odśwież stronę i spróbuj ponownie." },
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // 3. Walidacja danych kontaktowych
      email = email.trim();
      phone = phone.trim();
      name = name.trim();
      message = message.trim();

      if (!email && !phone) {
        return Response.json(
          { success: false, error: "Podaj przynajmniej jeden sposób kontaktu: adres e-mail lub telefon." },
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json(
          { success: false, error: "Wprowadzony adres e-mail jest nieprawidłowy." },
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!message && !calcSummary) {
        return Response.json(
          { success: false, error: "Wiadomość z opisem zapytania nie może być pusta." },
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Walidacja plików
      if (incomingFiles.length > MAX_FILES_COUNT) {
        return Response.json(
          { success: false, error: `Możesz załączyć maksymalnie ${MAX_FILES_COUNT} plików naraz.` },
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const file of incomingFiles) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return Response.json(
            {
              success: false,
              error: `Plik "${file.name}" ma niedozwolony format (.${ext}). Dozwolone: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
            },
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          return Response.json(
            {
              success: false,
              error: `Plik "${file.name}" przekracza maksymalny limit 100 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
            },
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // 5. Generowanie ID leada i struktura daty
      const leadId = crypto.randomUUID();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const savedFilesMeta: Array<{ originalName: string; storageKey: string; size: number; mimeType: string }> = [];

      // 6. Zapis plików do R2
      if (incomingFiles.length > 0) {
        if (!env.LEAD_FILES) {
          console.error("Binding R2 (LEAD_FILES) nie jest dostępny!");
          return Response.json(
            { success: false, error: "Błąd konfiguracji magazynu plików R2." },
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        for (const file of incomingFiles) {
          const safeName = sanitizeFilename(file.name);
          const storageKey = `leads/${year}/${month}/${leadId}/${safeName}`;

          await env.LEAD_FILES.put(storageKey, file.stream(), {
            httpMetadata: {
              contentType: file.type || "application/octet-stream",
            },
            customMetadata: {
              originalName: file.name,
              leadId: leadId,
              sizeBytes: String(file.size),
              uploadedAt: now.toISOString(),
            },
          });

          savedFilesMeta.push({
            originalName: file.name,
            storageKey,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          });
        }
      }

      // 7. Wysłanie powiadomienia e-mail przez Resend
      if (env.RESEND_API_KEY) {
        try {
          const resend = new Resend(env.RESEND_API_KEY);
          const recipientEmail = env.NOTIFICATION_EMAIL || "kontakt@multicore.net.pl";
          const fromEmail = env.FROM_EMAIL || "MULTICORE Formularz <formularz@multicore.net.pl>";

          let filesHtml = "<p><em>Brak załączonych plików</em></p>";
          let filesText = "Brak plików";

          if (savedFilesMeta.length > 0) {
            filesHtml = `<ul>` + savedFilesMeta.map(f => `<li><strong>${f.originalName}</strong> (${(f.size / (1024 * 1024)).toFixed(2)} MB) &mdash; <code>${f.storageKey}</code></li>`).join("") + `</ul>`;
            filesText = savedFilesMeta.map(f => `- ${f.originalName} (${(f.size / (1024 * 1024)).toFixed(2)} MB) [${f.storageKey}]`).join("\n");
          }

          let calcHtml = "";
          let calcText = "";
          if (calcSummary) {
            calcHtml = `
              <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 8px 0; color: #0f172a;">📊 Dane z kalkulatora:</h3>
                <pre style="margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 13px;">${calcSummary}</pre>
              </div>
            `;
            calcText = `\n--- DANE Z KALKULATORA ---\n${calcSummary}\n`;
          }

          const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px;">
              <div style="background: #0b0f19; color: #fff; padding: 18px 24px; border-radius: 8px 8px 0 0; border-bottom: 3px solid #38bdf8;">
                <h2 style="margin: 0; color: #38bdf8; font-size: 20px;">Nowe zapytanie ofertowe MULTICORE</h2>
                <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">ID Leada: <code>${leadId}</code></div>
              </div>

              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #64748b;">Klient / Firma:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${name || "—"} ${company ? `(${company})` : ""}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Adres e-mail:</td>
                    <td style="padding: 6px 0;"><a href="mailto:${email}" style="color: #0284c7; text-decoration: underline;">${email || "—"}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Telefon:</td>
                    <td style="padding: 6px 0;"><a href="tel:${phone}" style="color: #0284c7; text-decoration: none;">${phone || "—"}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Preferowany kontakt:</td>
                    <td style="padding: 6px 0;">${preferredContact || "e-mail"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Temat / Usługa:</td>
                    <td style="padding: 6px 0;"><strong>${topic || "Wycena ogólna"}</strong></td>
                  </tr>
                  ${utmSource ? `
                  <tr>
                    <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Źródło (UTM):</td>
                    <td style="padding: 6px 0; font-size: 12px; color: #64748b;">source: ${utmSource} | medium: ${utmMedium || "—"} | campaign: ${utmCampaign || "—"}</td>
                  </tr>` : ""}
                </table>

                <div style="background: #f8fafc; border-left: 4px solid #38bdf8; padding: 14px; margin-bottom: 20px; border-radius: 4px;">
                  <h4 style="margin: 0 0 6px 0; color: #0f172a;">Treść zapytania / Opis części:</h4>
                  <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #1e293b;">${message || "—"}</p>
                </div>

                ${calcHtml}

                <div style="margin-top: 20px;">
                  <h4 style="margin: 0 0 8px 0; color: #0f172a;">Załączone pliki w Cloudflare R2 (${savedFilesMeta.length}):</h4>
                  ${filesHtml}
                </div>

                <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
                  Wiadomość wygenerowana automatycznie przez Cloudflare Worker (multicore.net.pl) &bull; ${now.toLocaleString("pl-PL")}
                </div>
              </div>
            </body>
            </html>
          `;

          const textBody = `
NOWE ZAPYTANIE MULTICORE
Lead ID: ${leadId}
Data: ${now.toLocaleString("pl-PL")}

Klient: ${name || "—"} ${company ? `(${company})` : ""}
Email: ${email || "—"}
Telefon: ${phone || "—"}
Preferowany kontakt: ${preferredContact || "e-mail"}
Temat: ${topic || "Wycena"}
${utmSource ? `UTM: ${utmSource} / ${utmMedium} / ${utmCampaign}` : ""}

TREŚĆ:
${message || "—"}
${calcText}
PLIKI W R2 (${savedFilesMeta.length}):
${filesText}
          `.trim();

          let emailResponse = await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            subject: `Nowe zapytanie MULTICORE [${topic || "Wycena"}] — ${name || email || leadId.slice(0, 8)}`,
            html: htmlBody,
            text: textBody,
            replyTo: email || undefined,
          });

          // Jeśli domena multicore.net.pl nie została jeszcze zweryfikowana w Resend (Etap 6)
          if (emailResponse.error && (emailResponse.error.message?.includes("not verified") || emailResponse.error.name === "validation_error")) {
            console.warn("Domena multicore.net.pl oczekuje na weryfikację DNS w Resend. Wysyłam przez testowy adres onboarding@resend.dev na maksym.leski@gmail.com...");
            emailResponse = await resend.emails.send({
              from: "MULTICORE Formularz <onboarding@resend.dev>",
              to: "maksym.leski@gmail.com",
              subject: `[MULTICORE] Nowe zapytanie [${topic || "Wycena"}] — ${name || email || leadId.slice(0, 8)}`,
              html: htmlBody,
              text: textBody,
              replyTo: email || undefined,
            });
          }

          if (emailResponse.error) {
            console.error("Resend API error:", emailResponse.error);
          } else {
            console.log("E-mail wysłany pomyślnie przez Resend. ID:", emailResponse.data?.id);
          }
        } catch (emailErr) {
          console.error("Nie udało się wysłać powiadomienia e-mail przez Resend:", emailErr);
          // Nie przerywamy odpowiedzi sukcesu jeśli dane i pliki zostały już bezpiecznie zachowane w R2
        }
      }

      // 8. Sukces
      return Response.json(
        {
          success: true,
          leadId,
          filesCount: savedFilesMeta.length,
          message: "Dziękujemy. Zapytanie zostało przyjęte.",
        },
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      console.error("Błąd przetwarzania leada:", err);
      return Response.json(
        {
          success: false,
          error: "Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie lub skontaktuj się telefonicznie.",
          details: err?.message || String(err),
        },
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};
