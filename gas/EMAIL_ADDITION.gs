// ═══════════════════════════════════════════════════════════════════
// SUNLITE CRM — EMAIL INTEGRATION (paste into your existing script)
//
// TWO PARTS:
//   PART 1 → paste inside doGet() just before the "not handled" return
//   PART 2 → paste anywhere as new top-level functions
//
// PERMISSIONS: After pasting, click "Run" on syncNewCustomerEmails()
//   once — Google will ask you to authorize Gmail access. That's it.
// ═══════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────
// PART 1: Add inside doGet(), just before the "not handled" return
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

      GmailApp.sendEmail(to, subject, body, {
        name: repName || "Sunlite Sales",
        replyTo: e.parameter.userEmail || ""
      });

      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (logSheet) {
        const headers = logSheet.getDataRange().getValues()[0]
          .map(h => h.toString().replace(/\s+/g, ""));
        const row = headers.map(h => {
          if (h === "Timestamp")    return new Date();
          if (h === "UserEmail")    return e.parameter.userEmail || "";
          if (h === "CustomerName") return custName;
          if (h === "CustomerID")   return custId;
          if (h === "Notes")        return "[Gmail to: " + to + "] " + subject + "\n" + body.substring(0, 300);
          if (h === "LogType")      return "Email";
          if (h === "NewEmail")     return to;
          return "";
        });
        logSheet.appendRow(row);
      }

      return createJsonResponse({ status: "Success" });
    }

    // --- SUNLITE CRM: SYNC EMAILS ---
    if (action === "syncEmails") {
      syncNewCustomerEmails();
      return createJsonResponse({ status: "ok" });
    }


// ───────────────────────────────────────────────────────────────────
// PART 2: New top-level functions — paste anywhere in the script
// ───────────────────────────────────────────────────────────────────

/**
 * Scans Gmail INBOX (received) and SENT (outgoing) for emails to/from
 * known customer addresses in the last 25 hours.
 * Logs each as an "Email" entry in the Log sheet.
 * Deduplicates via [gmail-id:xxx] tag in Notes.
 *
 * Set up a daily time-driven trigger:
 *   Apps Script → Triggers → + Add Trigger
 *   Function: syncNewCustomerEmails
 *   Event source: Time-driven → Day timer → any hour
 */
function syncNewCustomerEmails() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
  const logSheet  = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
  if (!custSheet || !logSheet) return;

  // ── Build customer email → { name, id } map ───────────────────
  const custData    = custSheet.getDataRange().getValues();
  const custHeaders = custData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const emailIdx    = ["email","customeremail"].reduce((a, k) => a !== -1 ? a : custHeaders.indexOf(k), -1);
  const nameIdx     = ["customername","customer"].reduce((a, k) => a !== -1 ? a : custHeaders.indexOf(k), 1);
  const idIdx       = custHeaders.indexOf("id") !== -1 ? custHeaders.indexOf("id") : 0;

  const customerMap = {};
  for (let i = 1; i < custData.length; i++) {
    const email = emailIdx >= 0 ? String(custData[i][emailIdx]).toLowerCase().trim() : "";
    if (email && email.includes("@")) {
      customerMap[email] = {
        name: String(custData[i][nameIdx] || ""),
        id:   String(custData[i][idIdx]   || "")
      };
    }
  }
  if (Object.keys(customerMap).length === 0) return;

  // ── Collect already-logged gmail-ids to avoid duplicates ──────
  const logData  = logSheet.getDataRange().getValues();
  const logHdrs  = logData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const notesIdx = logHdrs.indexOf("notes");
  const logged   = new Set();
  for (let i = 1; i < logData.length; i++) {
    const m = String(logData[i][notesIdx] || "").match(/\[gmail-id:([^\]]+)\]/);
    if (m) logged.add(m[1]);
  }

  const emailAddrs = Object.keys(customerMap).join(" OR ");

  function appendEmailRow(msg, direction, customer) {
    const msgId = msg.getId();
    if (logged.has(msgId)) return;
    logged.add(msgId); // prevent double-logging within this run

    const counterpart = direction === "received" ? msg.getFrom() : msg.getTo();
    // Extract bare address
    const addrMatch = counterpart.match(/<(.+?)>/);
    const addr = (addrMatch ? addrMatch[1] : counterpart).toLowerCase().trim();

    const tag = direction === "received"
      ? "[Gmail from: " + addr + "]"
      : "[Gmail to: " + addr + "]";

    const notes = tag + " " + msg.getSubject() + "\n" +
                  msg.getPlainBody().substring(0, 400).replace(/\n+/g, " ") +
                  " [gmail-id:" + msgId + "]";

    const headers = logSheet.getDataRange().getValues()[0]
      .map(h => h.toString().replace(/\s+/g, ""));
    const row = headers.map(h => {
      if (h === "Timestamp")    return msg.getDate();
      if (h === "UserEmail")    return direction === "received" ? addr : "sent";
      if (h === "CustomerName") return customer.name;
      if (h === "CustomerID")   return customer.id;
      if (h === "Notes")        return notes;
      if (h === "LogType")      return "Email";
      if (h === "NewEmail")     return addr;
      return "";
    });
    logSheet.appendRow(row);
  }

  // ── Scan INBOX: emails FROM customers ────────────────────────
  try {
    const inboxThreads = GmailApp.search("in:inbox from:(" + emailAddrs + ") newer_than:2d", 0, 100);
    inboxThreads.forEach(thread => {
      thread.getMessages().forEach(msg => {
        const fromRaw   = msg.getFrom();
        const fromMatch = fromRaw.match(/<(.+?)>/);
        const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).toLowerCase().trim();
        const customer  = customerMap[fromEmail];
        if (customer) appendEmailRow(msg, "received", customer);
      });
    });
  } catch(e) { Logger.log("Inbox scan error: " + e); }

  // ── Scan SENT: emails TO customers ───────────────────────────
  try {
    const sentThreads = GmailApp.search("in:sent to:(" + emailAddrs + ") newer_than:2d", 0, 100);
    sentThreads.forEach(thread => {
      thread.getMessages().forEach(msg => {
        // Match any recipient that is a known customer
        const toAddrs = msg.getTo().split(",").map(a => {
          const m = a.match(/<(.+?)>/);
          return (m ? m[1] : a).toLowerCase().trim();
        });
        const customer = toAddrs.reduce((found, addr) => found || customerMap[addr] || null, null);
        if (customer) appendEmailRow(msg, "sent", customer);
      });
    });
  } catch(e) { Logger.log("Sent scan error: " + e); }

  Logger.log("syncNewCustomerEmails complete");
}
