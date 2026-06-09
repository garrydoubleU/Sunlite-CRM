// ═══════════════════════════════════════════════════════════════════
// SUNLITE CRM — EMAIL INTEGRATION (paste into your existing script)
//
// TWO PARTS:
//   PART 1 → paste inside doPost() just before the "not handled" return
//   PART 2 → paste anywhere as new top-level functions
//
// PERMISSIONS: After pasting, click "Run" on syncNewCustomerEmails()
//   once — Google will ask you to authorize Gmail access. That's it.
//   No admin panel, no OAuth app, no extra setup.
// ═══════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────
// PART 1: Add inside doPost(), just before the "not handled" return
// ───────────────────────────────────────────────────────────────────

    // --- SUNLITE CRM: SEND EMAIL ---
    if (action === "sendEmail") {
      const to       = e.parameter.to       || "";
      const subject  = e.parameter.subject  || "(no subject)";
      const body     = e.parameter.body     || "";
      const repName  = e.parameter.repName  || e.parameter.userEmail || "";
      const custName = e.parameter.customerName || "";
      const custId   = e.parameter.customerId   || custName;

      if (!to) return createJsonResponse({ status: "Error", message: "No recipient" });

      // Send via Gmail (runs as the Google account that owns the script)
      GmailApp.sendEmail(to, subject, body, {
        name: "Sunlite Sales",
        replyTo: e.parameter.userEmail || ""
      });

      // Auto-log to the sheet in the same format as saveLog
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (logSheet) {
        const headers = logSheet.getDataRange().getValues()[0]
          .map(h => h.toString().replace(/\s+/g, ""));
        // Build a row that matches the existing column order
        const row = headers.map(h => {
          if (h === "Timestamp")    return new Date();
          if (h === "UserEmail")    return e.parameter.userEmail || "";
          if (h === "CustomerName") return custName;
          if (h === "CustomerID")   return custId;
          if (h === "Notes")        return "[Email sent] " + subject + "\n" + body.substring(0, 300);
          if (h === "LogType")      return "Email";
          if (h === "Reason")       return "";
          if (h === "NewEmail")     return to;
          if (h === "FollowUpDate") return "";
          if (h === "Priority")     return "";
          return "";
        });
        logSheet.appendRow(row);
      }

      return createJsonResponse({ status: "Success" });
    }


// ───────────────────────────────────────────────────────────────────
// PART 2: New top-level functions — paste anywhere in the script
// ───────────────────────────────────────────────────────────────────

/**
 * Scans Gmail for emails FROM customer addresses received in the last
 * 25 hours and logs them to the sheet as "gmail-auto" entries.
 *
 * Set up a daily time-driven trigger:
 *   Apps Script → Triggers → + Add Trigger
 *   Function: syncNewCustomerEmails
 *   Event source: Time-driven → Day timer → any hour
 */
function syncNewCustomerEmails() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet  = ss.getSheetByName("Customers") || ss.getSheets()[0];
  const logSheet   = ss.getSheetByName("Log")       || ss.getSheetByName("Logs");
  if (!custSheet || !logSheet) return;

  // ── Build a map of customer email → { name, id } ──────────────
  const custData    = custSheet.getDataRange().getValues();
  const custHeaders = custData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const emailIdx    = custHeaders.indexOf("email")       !== -1 ? custHeaders.indexOf("email")       :
                      custHeaders.indexOf("customeremail") !== -1 ? custHeaders.indexOf("customeremail") : -1;
  const nameIdx     = custHeaders.indexOf("customername") !== -1 ? custHeaders.indexOf("customername") :
                      custHeaders.indexOf("customer")     !== -1 ? custHeaders.indexOf("customer")     : 1;
  const idIdx       = custHeaders.indexOf("id") !== -1 ? custHeaders.indexOf("id") : 0;

  const customerMap = {};
  for (let i = 1; i < custData.length; i++) {
    const email = emailIdx >= 0 ? String(custData[i][emailIdx]).toLowerCase().trim() : "";
    if (email && email !== "undefined" && email.includes("@")) {
      customerMap[email] = {
        name: String(custData[i][nameIdx] || ""),
        id:   String(custData[i][idIdx]   || "")
      };
    }
  }

  // ── Get existing logged gmail-auto message IDs to avoid duplicates ─
  const logData    = logSheet.getDataRange().getValues();
  const logHeaders = logData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const notesIdx   = logHeaders.indexOf("notes");
  const logged = new Set();
  for (let i = 1; i < logData.length; i++) {
    const notes = String(logData[i][notesIdx] || "");
    const m = notes.match(/\[gmail-id:([^\]]+)\]/);
    if (m) logged.add(m[1]);
  }

  // ── Search Gmail: last 25 hours ────────────────────────────────
  const threads = GmailApp.search("newer_than:2d", 0, 100);

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const msgId = msg.getId();
      if (logged.has(msgId)) return; // already logged

      // Extract sender email
      const fromRaw  = msg.getFrom();
      const fromMatch = fromRaw.match(/<(.+?)>/);
      const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).toLowerCase().trim();

      const customer = customerMap[fromEmail];
      if (!customer) return; // not a known customer

      // Build log row matching existing column order
      const logHeaders2 = logSheet.getDataRange().getValues()[0]
        .map(h => h.toString().replace(/\s+/g, ""));
      const row = logHeaders2.map(h => {
        if (h === "Timestamp")    return msg.getDate();
        if (h === "UserEmail")    return "gmail-auto";
        if (h === "CustomerName") return customer.name;
        if (h === "CustomerID")   return customer.id;
        if (h === "Notes")        return "[gmail-auto] [gmail-id:" + msgId + "] " +
                                         msg.getSubject() + "\n" +
                                         msg.getPlainBody().substring(0, 400).replace(/\n+/g, " ");
        if (h === "LogType")      return "Email";
        if (h === "Reason")       return "";
        if (h === "NewEmail")     return fromEmail;
        if (h === "FollowUpDate") return "";
        if (h === "Priority")     return "";
        return "";
      });
      logSheet.appendRow(row);
    });
  });

  Logger.log("syncNewCustomerEmails complete");
}
