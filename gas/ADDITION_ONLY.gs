// ─────────────────────────────────────────────────────────────────
// ADD THIS BLOCK TO YOUR EXISTING APPS SCRIPT
// Paste it inside your doGet() function, just before the final:
//   return createJsonResponse({ error: "Action '" + action + "' not handled." });
// ─────────────────────────────────────────────────────────────────

    // --- SUNLITE CRM: DELETE LOG ---
    if (action === "deleteLog") {
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (!logSheet) return createJsonResponse({ status: "Error", message: "Log sheet not found" });

      const id = e.parameter.id || "";
      if (!id) return createJsonResponse({ status: "Error", message: "No id provided" });

      const data = logSheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      const idIdx = headers.indexOf("ID") !== -1 ? headers.indexOf("ID") : headers.indexOf("id");

      for (let i = 1; i < data.length; i++) {
        if (idIdx >= 0 && String(data[i][idIdx]).trim() === id.trim()) {
          logSheet.deleteRow(i + 1);
          return createJsonResponse({ status: "Success" });
        }
      }
      // Row not found — treat as success (already deleted)
      return createJsonResponse({ status: "Success" });
    }

// ─────────────────────────────────────────────────────────────────
// THAT'S THE ONLY CHANGE NEEDED. Everything else is handled in
// the React app by mapping your existing column names to the new format.
// ─────────────────────────────────────────────────────────────────
