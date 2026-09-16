import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("multicore-leads-api worker", () => {
  it("responds to /health with status 200", async () => {
    const request = new IncomingRequest("http://localhost:8787/health");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("multicore-leads-api");
  });

  it("handles CORS OPTIONS preflight correctly", async () => {
    const request = new IncomingRequest("http://localhost:8787/lead", {
      method: "OPTIONS",
      headers: {
        Origin: "https://multicore.net.pl",
        "Access-Control-Request-Method": "POST",
      },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://multicore.net.pl");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("validates required fields on POST /lead", async () => {
    const request = new IncomingRequest("http://localhost:8787/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://multicore.net.pl",
      },
      body: JSON.stringify({
        name: "Test",
        // missing email and phone
        message: "Test message",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.success).toBe(false);
  });

  it("processes valid lead via JSON and returns leadId", async () => {
    const request = new IncomingRequest("http://localhost:8787/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://multicore.net.pl",
      },
      body: JSON.stringify({
        name: "Jan Kowalski",
        email: "jan@example.com",
        phone: "+48123456789",
        message: "Proszę o wycenę skanowania 3D",
        topic: "skanowanie",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.success).toBe(true);
    expect(data.leadId).toBeDefined();
  });

  it("processes multipart/form-data lead with file upload into R2", async () => {
    const formData = new FormData();
    formData.append("name", "Maksym");
    formData.append("email", "maksym@multicore.net.pl");
    formData.append("message", "Załączam plik CAD do wyceny.");
    
    // Tworzymy plik symulacyjny STL
    const testFile = new File(["solid test\nendsolid"], "part.stl", { type: "model/stl" });
    formData.append("files[]", testFile);

    const request = new IncomingRequest("http://localhost:8787/lead", {
      method: "POST",
      headers: {
        Origin: "https://multicore.net.pl",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.success).toBe(true);
    expect(data.filesCount).toBe(1);
  });

  it("rejects forbidden file extensions", async () => {
    const formData = new FormData();
    formData.append("name", "Hacker");
    formData.append("email", "test@example.com");
    formData.append("message", "Trojan file");
    
    const badFile = new File(["malicious"], "exploit.exe", { type: "application/x-msdownload" });
    formData.append("files[]", badFile);

    const request = new IncomingRequest("http://localhost:8787/lead", {
      method: "POST",
      headers: {
        Origin: "https://multicore.net.pl",
      },
      body: formData,
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.success).toBe(false);
    expect(data.error).toContain(".exe");
  });
});
