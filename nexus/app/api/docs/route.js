import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

async function loadSpec() {
   const candidates = [
      path.join(process.cwd(), "docs", "api", "openapi.json"),
      path.join(process.cwd(), "..", "docs", "api", "openapi.json"),
   ];
   for (const file of candidates) {
      try {
         const raw = await readFile(file, "utf8");
         return JSON.parse(raw);
      } catch {
         // try next
      }
   }
   // Fallback inline minimal spec if file missing at runtime
   return {
      openapi: "3.0.3",
      info: { title: "Nexus Inventory API — Phase 1", version: "1.0.0" },
      paths: {},
   };
}

export async function GET(request) {
   const { searchParams } = new URL(request.url);
   const format = (searchParams.get("format") || "html").toLowerCase();
   const spec = await loadSpec();

   if (format === "json") {
      return NextResponse.json(spec);
   }

   const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nexus Inventory API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0} .topbar{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/docs?format=json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`;

   return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
   });
}
