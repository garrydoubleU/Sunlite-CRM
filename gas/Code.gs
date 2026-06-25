/**
 * GOOGLE APPS SCRIPT — SUNLITE CRM HUB
 * Version 4.0 — Styled HTML emails; assignment alerts to Simon, CW, and new rep
 *
 * Handles: login, customers (own + all), logs (read/save/delete), users,
 *          quick links, email send, gmail sync, customer-email update,
 *          account assignment + alerts, access requests, CS handoffs.
 *
 * Deploy: Deploy > New deployment > Web app > Execute as "Me",
 *         Access "Anyone". Copy the /exec URL into VITE_GAS_URL.
 *         Re-deploy a NEW VERSION every time you change this file.
 *
 * Script Properties required:
 *   APP_URL  →  https://sunlite-crm.vercel.app/
 *
 * Sheets used (auto-created when missing): Customers, Users, Log,
 *   "quick links", Assignments, AccessRequests, CSHandoffs, Contacts.
 */

// ─────────────────────────────────────────────────────────────────
// TOP-LEVEL CONSTANTS
// ─────────────────────────────────────────────────────────────────

var ASSIGNMENT_HEADERS = [
  "ID", "CustomerID", "CustomerName",
  "AssignedToEmail", "AssignedToName",
  "AssignedByEmail", "AssignedByName",
  "Date", "Acknowledged"
];
var ACCESS_HEADERS = [
  "ID", "CustomerID", "CustomerName",
  "RequesterEmail", "RequesterName", "Date", "Status"
];

// People who always get a copy of assignment notifications
var ASSIGNMENT_CC = ["simon@sunshinelighting.com", "cweber@sunshinelighting.com"];

// ─────────────────────────────────────────────────────────────────
// ENTRY POINTS
// ─────────────────────────────────────────────────────────────────

function doGet(e) {
  if (!e || !e.parameter) {
    return createJsonResponse({
      error: "Run via the deployed Web App URL, not the editor.",
      help:  "Deploy > New Deployment > Web App."
    });
  }

  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const action    = e.parameter.action;
  const userEmail = (e.parameter.userEmail || "").toString().toLowerCase().trim();

  try {

    // ──────────────────────────────────── 1. LOGIN
    if (action === "login") {
      const password  = (e.parameter.password || "").toString().trim();
      const userSheet = ss.getSheetByName("Users");
      const userData  = userSheet.getDataRange().getValues();
      const headers   = userData[0].map(h => h.toString().toLowerCase().trim());
      const emailIdx  = headers.indexOf("email");
      const passIdx   = headers.indexOf("password");
      const roleIdx   = headers.indexOf("role");
      const nameIdx   = headers.indexOf("username");

      const userRow = userData.slice(1).find(row =>
        row[emailIdx]?.toString().toLowerCase().trim() === userEmail &&
        row[passIdx]?.toString().trim() === password
      );
      if (!userRow) return createJsonResponse({ error: "Invalid credentials" });

      return createJsonResponse({
        status:   "Success",
        userRole: userRow[roleIdx],
        userName: userRow[nameIdx] || userEmail.split("@")[0]
      });
    }

    // ──────────────────────────────────── 2. GET CUSTOMERS (rep-filtered)
    if (action === "getCustomers") {
      const customerSheet = ss.getSheetByName("Customers");
      const data          = customerSheet.getDataRange().getValues();
      const headers       = data[0];
      const rows          = data.slice(1);

      const userSheet  = ss.getSheetByName("Users");
      const userData   = userSheet.getDataRange().getValues();
      const userRecord = userData.find(row => row[0]?.toString().toLowerCase().trim() === userEmail);
      const role       = userRecord ? userRecord[1] : "Salesman";
      const roleLow    = (role || "").toString().toLowerCase();
      const isAdmin    = roleLow === "admin" || roleLow === "administrator" ||
                         roleLow === "owner" || roleLow === "customer_service";

      const repIndex   = headers.findIndex(h => {
        const head = h.toString().toLowerCase();
        return head.includes("sales rep email") || head.includes("salesrep") || head.includes("rep");
      });
      const assignedIdx = headers.findIndex(h =>
        h.toString().toLowerCase().trim() === "assignedsalesman" ||
        h.toString().toLowerCase().trim() === "assigned salesman"
      );

      const filtered = isAdmin ? rows : rows.filter(row => {
        const repField      = (row[repIndex]   || "").toString().toLowerCase();
        const assignedField = assignedIdx !== -1 ? (row[assignedIdx] || "").toString().toLowerCase() : "";
        const combined      = [repField, assignedField].filter(Boolean).join(",");
        const repList       = combined.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean);
        return repList.includes(userEmail) || repList.includes("open");
      });

      return createJsonResponse(filtered.map(row => mapCustomerRow(headers, row)));
    }

    // ──────────────────────────────────── 2b. GET ALL CUSTOMERS
    if (action === "getAllCustomers") {
      const customerSheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
      if (!customerSheet) return createJsonResponse([]);
      const data = customerSheet.getDataRange().getValues();
      if (data.length < 2) return createJsonResponse([]);
      const headers = data[0];
      const rows    = data.slice(1).filter(row => row.some(c => c !== "" && c !== null));
      return createJsonResponse(rows.map(row => mapCustomerRow(headers, row)));
    }

    // ──────────────────────────────────── 3. GET LOGS
    if (action === "getLogs") {
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (!logSheet) return createJsonResponse([]);
      const data    = logSheet.getDataRange().getValues();
      const headers = data[0];
      const rows    = data.slice(1).filter(row => row[0] !== "" && row[0] !== null);
      const result  = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          const key = h.toString().replace(/\s+/g, "");
          obj[key] = row[i] instanceof Date ? row[i].toISOString() : row[i];
        });
        return obj;
      });
      return createJsonResponse(result.reverse().slice(0, 2000));
    }

    // ──────────────────────────────────── 4. SAVE LOG
    if (action === "saveLog") {
      const logSheet      = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      const customerSheet = ss.getSheetByName("Customers");

      const timestamp      = new Date();
      const customerName   = e.parameter.CustomerName || "";
      const customerID     = e.parameter.CustomerID   || "";
      const notes          = e.parameter.Notes || e.parameter.summary || "";
      const followUpDate   = e.parameter.FollowUpDate || "";
      const priority       = e.parameter.Priority     || "";
      const cleanType      = (e.parameter.type || "").toString().toLowerCase().trim();
      const logType        = e.parameter.LogType || typeLabel(cleanType) || "Note";
      const id             = e.parameter.id || ("log_" + timestamp.getTime());
      const visitFrequency = e.parameter.VisitFrequency || "";
      const visitStartDate = e.parameter.VisitStartDate || "";
      const repName        = e.parameter.repName || e.parameter.RepName || "";

      // A. Append to Log sheet
      const logHeaders = logSheet.getDataRange().getValues()[0]
        .map(h => h.toString().replace(/\s+/g, "").toLowerCase());
      const row = logHeaders.map(h => {
        if (h === "id")                                                         return id;
        if (h === "timestamp" || h === "date")                                  return timestamp;
        if (h === "useremail" || h === "email" || h === "remail" ||
            h === "salesrepemail")                                               return userEmail;
        if (h === "repname" || h === "salesrep" || h === "rep" ||
            h === "salesperson")                                                 return repName || userEmail;
        if (h === "username" || h === "user" || h === "loggedby")               return repName || userEmail;
        if (h === "customername" || h === "customer")                           return customerName;
        if (h === "customerid"   || h === "custid")                             return customerID;
        if (h === "notes" || h === "summary" || h === "note")                   return notes;
        if (h === "reason")                                                     return e.parameter.Reason   || "";
        if (h === "newemail")                                                   return e.parameter.NewEmail || "";
        if (h === "followupdate" || h === "followup")                           return followUpDate;
        if (h === "notifyrep"    || h === "notify")                             return e.parameter.notifyRep || "";
        if (h === "logtype" || h === "type" || h === "activitytype")            return logType;
        if (h === "priority")                                                   return priority;
        return "";
      });
      logSheet.appendRow(row);

      // B. Update Customers record
      const custData    = customerSheet.getDataRange().getValues();
      const custHeaders = custData[0].map(h => h.toString().toLowerCase().trim());
      const idIdx       = custHeaders.findIndex(h => h.includes("id"));
      const nameIdx     = custHeaders.findIndex(h => h === "customername" || h === "customer");
      const priorityIdx = custHeaders.findIndex(h => h === "priority");
      const followIdx   = custHeaders.findIndex(h => h.includes("followup") || h.includes("follow up"));
      const freqIdx     = custHeaders.findIndex(h =>
        h.includes("visit frequency") || h === "visitfrequency" || h === "frequency");
      const dateIdx     = custHeaders.findIndex(h =>
        h.includes("route commencement date") || h.includes("visit start date"));

      for (let i = 1; i < custData.length; i++) {
        const rowId   = custData[i][idIdx]?.toString().trim();
        const rowName = custData[i][nameIdx]?.toString().trim().toLowerCase();
        const isMatch = (customerID && rowId === customerID.trim()) ||
                        (customerName && rowName === customerName.toLowerCase().trim());
        if (!isMatch) continue;

        if (priorityIdx !== -1 && priority)       customerSheet.getRange(i+1, priorityIdx+1).setValue(priority);
        if (followIdx   !== -1 && followUpDate)   customerSheet.getRange(i+1, followIdx+1).setValue(followUpDate);
        if (freqIdx     !== -1 && visitFrequency) customerSheet.getRange(i+1, freqIdx+1).setValue(visitFrequency);
        if (dateIdx     !== -1 && visitStartDate) customerSheet.getRange(i+1, dateIdx+1).setValue(visitStartDate);

        const lastContactIdx = custHeaders.findIndex(h =>
          h.includes("lastcontact") || h === "last contact date" ||
          h === "lastcontactdate"   || h === "date of last contact"
        );
        if (lastContactIdx !== -1) customerSheet.getRange(i+1, lastContactIdx+1).setValue(new Date());
        break;
      }

      // C. Notify rep (if checkbox ticked)
      const notifyRep = (e.parameter.notifyRep || "").toLowerCase() === "true";
      if (notifyRep) {
        const custHeadersNS  = custData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
        const custIdIdx2     = custHeadersNS.findIndex(h => h === "customerid" || h === "custid" || h === "id");
        const custNameIdx2   = custHeadersNS.findIndex(h => h === "customername" || h === "customer");
        const repNameColIdx  = custHeadersNS.findIndex(h => h === "salespersonname" || h === "repname");

        let repDisplayName = "";
        for (let i = 1; i < custData.length; i++) {
          const rowId   = String(custData[i][custIdIdx2]   || "").trim();
          const rowName = String(custData[i][custNameIdx2] || "").trim().toLowerCase();
          const isMatch = (customerID && rowId === customerID.trim()) ||
                          (customerName && rowName === customerName.toLowerCase().trim());
          if (isMatch) {
            repDisplayName = repNameColIdx !== -1 ? String(custData[i][repNameColIdx] || "").trim() : "";
            break;
          }
        }

        let firstRepEmail = "";
        let firstRepName  = repDisplayName;
        if (repDisplayName) {
          const uSheet = ss.getSheetByName("Users");
          if (uSheet) {
            const uData     = uSheet.getDataRange().getValues();
            const uH        = uData[0].map(h => h.toString().toLowerCase().trim());
            const uEmailIdx = uH.indexOf("email");
            const uNameIdx  = uH.indexOf("username");
            const repLower  = repDisplayName.toLowerCase();
            for (let i = 1; i < uData.length; i++) {
              const uName = String(uData[i][uNameIdx] || "").trim().toLowerCase();
              if (uName && uName === repLower) {
                firstRepEmail = String(uData[i][uEmailIdx] || "").toLowerCase().trim();
                firstRepName  = String(uData[i][uNameIdx]  || "").trim();
                break;
              }
            }
          }
        }

        if (firstRepEmail) {
          const activityLabel = typeLabel(cleanType) || logType || "Activity";
          const appUrl        = getAppUrl();
          const plainBody     = buildPlainNotify(firstRepName, customerName, activityLabel, appUrl);
          const htmlBody      = buildNotifyEmail(firstRepName, customerName, activityLabel, appUrl);
          try {
            MailApp.sendEmail(firstRepEmail,
              "New notification — " + customerName,
              plainBody,
              { htmlBody: htmlBody, name: "Sunlite CRM" }
            );
          } catch(mailErr) {
            Logger.log("Rep notify email failed: " + mailErr.toString());
          }

          // Write CSHandoffs record
          const handoffSheet = getOrCreateSheet(ss, "CSHandoffs",
            ["ID","CustomerID","CustomerName","RepEmail","CSName","CSEmail","Date","Notes","Acknowledged","AckNotes","ActivityType"]);
          handoffSheet.appendRow([
            Utilities.getUuid(),
            customerID || customerName,
            customerName,
            firstRepEmail.toLowerCase(),
            repName || userEmail,
            userEmail.toLowerCase(),
            new Date(),
            notes,
            "false",
            "",
            logType || "note"
          ]);
        }
      }

      return createJsonResponse({ status: "Success" });
    }

    // ──────────────────────────────────── 4b. DELETE LOG
    if (action === "deleteLog") {
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (!logSheet) return createJsonResponse({ status: "Error", message: "Log sheet not found" });
      const id = e.parameter.id || "";
      if (!id) return createJsonResponse({ status: "Error", message: "No id provided" });
      const data    = logSheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const idIdx   = headers.indexOf("ID") !== -1 ? headers.indexOf("ID") : headers.indexOf("id");
      for (let i = 1; i < data.length; i++) {
        if (idIdx >= 0 && String(data[i][idIdx]).trim() === id.trim()) {
          logSheet.deleteRow(i + 1);
          return createJsonResponse({ status: "Success" });
        }
      }
      return createJsonResponse({ status: "Success" });
    }

    // ──────────────────────────────────── 5. GET USERS
    if (action === "getUsers") {
      const userSheet = ss.getSheetByName("Users");
      const data      = userSheet.getDataRange().getValues();
      const headers   = data[0];
      const result    = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let key = h.toString().trim();
          if (key.toLowerCase() === "username") key = "name";
          if (key.toLowerCase() === "email")    key = "email";
          if (key.toLowerCase() === "role")     key = "role";
          obj[key] = row[i];
        });
        return obj;
      });
      return createJsonResponse(result);
    }

    // ──────────────────────────────────── 6. GET QUICK LINKS
    if (action === "getQuickLinks") {
      const sheet = ss.getSheetByName("quick links");
      if (!sheet) return createJsonResponse([]);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      return createJsonResponse(data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          const key = h.toString().trim() || String.fromCharCode(65 + i);
          obj[key] = row[i];
        });
        return obj;
      }));
    }

    // ──────────────────────────────────── 7. SEND EMAIL
    if (action === "sendEmail") {
      const to      = e.parameter.to      || "";
      const subject = e.parameter.subject || "(no subject)";
      const body    = e.parameter.body    || "";
      const custName = e.parameter.customerName || "";
      const custId   = e.parameter.customerId   || custName;
      if (!to) return createJsonResponse({ status: "Error", message: "No recipient" });

      GmailApp.sendEmail(to, subject, body, {
        name:    "Sunlite Sales",
        replyTo: e.parameter.userEmail || ""
      });

      const logSheet2 = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (logSheet2) {
        const hdrs = logSheet2.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ""));
        logSheet2.appendRow(hdrs.map(h => {
          if (h === "Timestamp")    return new Date();
          if (h === "UserEmail")    return e.parameter.userEmail || "";
          if (h === "CustomerName") return custName;
          if (h === "CustomerID")   return custId;
          if (h === "Notes")        return "[Email sent] " + subject + "\n" + body.substring(0, 300);
          if (h === "LogType")      return "Email";
          if (h === "Type")         return "Email";
          if (h === "NewEmail")     return to;
          return "";
        }));
      }
      return createJsonResponse({ status: "Success" });
    }

    // ──────────────────────────────────── 8. GMAIL SYNC
    if (action === "syncEmails") {
      syncNewCustomerEmails();
      return createJsonResponse({ status: "ok" });
    }

    // ──────────────────────────────────── 9. UPDATE CUSTOMER EMAIL
    if (action === "updateCustomerEmail") {
      const sheet   = ss.getSheetByName("Customers") || ss.getSheets()[0];
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
      const idIdx   = headers.indexOf("id");
      const emailIdx = headers.findIndex(h => h === "email" || h === "customeremail");
      if (emailIdx === -1) return createJsonResponse({ error: "No email column found" });
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === e.parameter.customerId) {
          sheet.getRange(i + 1, emailIdx + 1).setValue(e.parameter.email);
          return createJsonResponse({ status: "ok" });
        }
      }
      return createJsonResponse({ error: "Customer not found" });
    }

    // ──────────────────────────────────── 10. ASSIGN CUSTOMER → rep
    if (action === "assignCustomer") {
      const result = assignCustomerToRep(
        ss,
        e.parameter.customerId   || "",
        e.parameter.customerName || "",
        (e.parameter.toEmail || "").toLowerCase().trim(),
        e.parameter.toName   || "",
        (e.parameter.byEmail || "").toLowerCase().trim(),
        e.parameter.byName   || ""
      );
      return createJsonResponse(result);
    }

    // ──────────────────────────────────── 11. GET ASSIGNMENTS (for a rep)
    if (action === "getAssignments") {
      const repEmail = (e.parameter.repEmail || userEmail || "").toLowerCase().trim();
      const sheet    = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
      const data     = sheet.getDataRange().getValues();
      const headers  = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const out      = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.AssignedToEmail || "").toLowerCase().trim() === repEmail &&
            String(obj.Acknowledged).toLowerCase() !== "true") {
          out.push(obj);
        }
      }
      return createJsonResponse(out.reverse());
    }

    // ──────────────────────────────────── 12. ACKNOWLEDGE ASSIGNMENT
    if (action === "acknowledgeAssignment") {
      const sheet = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
      setColumnByID(sheet, e.parameter.id || "", "Acknowledged", true);
      return createJsonResponse({ status: "Success" });
    }

    // ──────────────────────────────────── 13. REQUEST ACCESS
    if (action === "requestAccess") {
      const sheet = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const id    = "req_" + new Date().getTime();
      appendObj(sheet, {
        ID:             id,
        CustomerID:     e.parameter.customerId    || "",
        CustomerName:   e.parameter.customerName  || "",
        RequesterEmail: (e.parameter.requesterEmail || "").toLowerCase().trim(),
        RequesterName:  e.parameter.requesterName  || "",
        Date:   new Date(),
        Status: "pending"
      });
      const requesterName = e.parameter.requesterName || e.parameter.requesterEmail || "A rep";
      const customerName2 = e.parameter.customerName  || e.parameter.customerId    || "an account";
      const body = [
        requesterName + " has requested access to: " + customerName2,
        "",
        "Requester: " + (e.parameter.requesterEmail || ""),
        "Account: "   + customerName2,
        "",
        "Log in to the admin dashboard to grant or deny access."
      ].join("\n");
      try {
        MailApp.sendEmail(
          "garry@sunshinelighting.com,cweber@sunshinelighting.com",
          "Access Request — " + customerName2,
          body
        );
      } catch(mailErr) {
        Logger.log("Access request email failed: " + mailErr.toString());
      }
      return createJsonResponse({ status: "Success", id: id });
    }

    // ──────────────────────────────────── 14. GET ACCESS REQUESTS (admin)
    if (action === "getAccessRequests") {
      const sheet   = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const out     = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.Status || "pending").toLowerCase() === "pending") out.push(obj);
      }
      return createJsonResponse(out.reverse());
    }

    // ──────────────────────────────────── 15. RESOLVE ACCESS REQUEST
    if (action === "resolveAccessRequest") {
      const sheet   = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const id      = e.parameter.id || "";
      const grant   = String(e.parameter.grant).toLowerCase() === "true";
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.ID).trim() === id.trim()) {
          setColumnByID(sheet, id, "Status", grant ? "granted" : "denied");
          if (grant) {
            const repName = lookupUserName(ss, obj.RequesterEmail) || obj.RequesterName || "";
            assignCustomerToRep(ss, obj.CustomerID, obj.CustomerName,
              String(obj.RequesterEmail).toLowerCase().trim(), repName, "admin", "Admin");
            // Update Customer Type → SUNLITE on the Customers sheet
            setCustomerType(ss, obj.CustomerID, obj.CustomerName, "SUNLITE");
          }
          return createJsonResponse({ status: "Success" });
        }
      }
      return createJsonResponse({ status: "Success" });
    }

    // ──────────────────────────────────── 16. ADD CONTACT
    if (action === "addContact") {
      const customerName = e.parameter.customerName || "";
      const firstName    = e.parameter.firstName    || "";
      const lastName     = e.parameter.lastName     || "";
      const position     = e.parameter.position     || "";
      const contactEmail = e.parameter.contactEmail || "";
      const addedBy      = e.parameter.addedBy      || userEmail;
      const addedDate    = new Date().toLocaleDateString("en-US");

      const contactSheet = getOrCreateSheet(ss, "Contacts",
        ["ID","CustomerName","FirstName","LastName","Position","Email","AddedBy","Date"]);
      contactSheet.appendRow([
        Utilities.getUuid(),
        customerName, firstName, lastName, position, contactEmail, addedBy, addedDate
      ]);

      const fullName = [firstName, lastName].filter(Boolean).join(" ") || contactEmail;
      const body = [
        "A new contact was added to " + customerName + ":",
        "",
        "Name: "     + fullName,
        "Position: " + (position     || "—"),
        "Email: "    + (contactEmail || "—"),
        "",
        "Added by: " + addedBy,
        "Date: "     + addedDate,
      ].join("\n");
      try {
        MailApp.sendEmail("garry@sunshinelighting.com",
          "New Contact Added — " + customerName + ": " + fullName, body);
      } catch(mailErr) {
        Logger.log("addContact email failed: " + mailErr.toString());
      }
      return createJsonResponse({ status: "ok" });
    }

    // ──────────────────────────────────── CS HANDOFFS
    if (action === "getCSHandoffs") {
      const repEmail = (e.parameter.repEmail || userEmail || "").toLowerCase().trim();
      const sheet    = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse([]);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const out     = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.RepEmail || "").toLowerCase().trim() === repEmail &&
            String(obj.Acknowledged).toLowerCase() !== "true") {
          out.push(obj);
        }
      }
      return createJsonResponse(out);
    }

    if (action === "acknowledgeCSHandoff") {
      const id      = e.parameter.id      || "";
      const ackNote = e.parameter.ackNote || "";
      const sheet   = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse({ error: "No CSHandoffs sheet" });
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const idIdx2  = headers.indexOf("ID");
      for (let i = 1; i < data.length; i++) {
        if (idIdx2 >= 0 && String(data[i][idIdx2]) === id) {
          const ackIdx = headers.indexOf("Acknowledged");
          if (ackIdx >= 0) sheet.getRange(i+1, ackIdx+1).setValue("true");
          const ackNotesIdx = headers.indexOf("AckNotes");
          if (ackNotesIdx >= 0 && ackNote) sheet.getRange(i+1, ackNotesIdx+1).setValue(ackNote);
          return createJsonResponse({ status: "ok" });
        }
      }
      return createJsonResponse({ error: "Not found" });
    }

    if (action === "getCSHandoffsByCSEmail") {
      const csEmail = (e.parameter.csEmail || "").toLowerCase().trim();
      const sheet   = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse([]);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const out     = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.CSEmail || "").toLowerCase().trim() === csEmail) out.push(obj);
      }
      return createJsonResponse(out.reverse());
    }

    // ──────────────────────────────────── NUDGE REP (task reminder)
    if (action === "nudgeRep") {
      const id    = e.parameter.id || "";
      const sheet = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse({ error: "No CSHandoffs sheet" });
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
      const idIdx2  = headers.indexOf("ID");
      for (let i = 1; i < data.length; i++) {
        if (idIdx2 >= 0 && String(data[i][idIdx2]) === id) {
          const obj      = rowToObj(headers, data[i]);
          const repEmail = String(obj.RepEmail || "").toLowerCase().trim();
          const custName = String(obj.CustomerName || "");
          if (!repEmail) return createJsonResponse({ error: "No rep email" });
          const appUrl    = getAppUrl();
          const plainBody = buildPlainTaskReminder(custName, appUrl);
          const htmlBody  = buildTaskReminderEmail(custName, appUrl);
          try {
            MailApp.sendEmail(repEmail,
              "Reminder — open task on " + custName,
              plainBody,
              { htmlBody: htmlBody, name: "Sunlite CRM" }
            );
          } catch(mailErr) {
            return createJsonResponse({ error: "Email failed: " + mailErr.toString() });
          }
          return createJsonResponse({ status: "ok" });
        }
      }
      return createJsonResponse({ error: "Handoff not found" });
    }

    return createJsonResponse({ error: "Action '" + action + "' not handled." });

  } catch (err) {
    return createJsonResponse({ status: "Error", message: err.toString() });
  }
}

function doPost(e) { return doGet(e); }

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────
// HELPERS — GENERAL
// ─────────────────────────────────────────────────────────────────

function getAppUrl() {
  return PropertiesService.getScriptProperties().getProperty("APP_URL") || "https://sunlite-crm.vercel.app/";
}

function typeLabel(t) {
  switch (t) {
    case "call":  return "Phone Call";
    case "visit": return "Visit";
    case "email": return "Email";
    case "note":  return "Note";
    default:      return "";
  }
}

function mapCustomerRow(headers, row) {
  const obj = {};
  let salesRepEmail    = "";
  let assignedSalesman = "";
  headers.forEach((h, i) => {
    let key = h.toString().trim();
    const low = key.toLowerCase();
    if (low === "customer id")                                          key = "ID";
    if (low === "customername")                                         key = "Customer";
    if (low.includes("sales rep email"))  { key = "SalesRep"; salesRepEmail = String(row[i] || "").trim(); }
    if (low === "assignedsalesman" || low === "assigned salesman")      { assignedSalesman = String(row[i] || "").trim(); }
    if (low === "salesperson name")                                     key = "SalespersonName";
    if (low === "customer type")                                        key = "CustomerType";
    if (low === "last order date")                                      key = "LastOrderDate";
    if (low === "last contact date" || low === "lastcontactdate" ||
        low.includes("lastcontact"))                                    key = "LastContactDate";
    if (low === "visit frequency")                                      key = "VisitFrequency";
    if (low === "visit start date")                                     key = "VisitStartDate";
    const cleanKey = key.replace(/\s+/g, "_");
    const v = row[i];
    obj[cleanKey] = v instanceof Date ? v.toISOString() : v;
  });
  if (assignedSalesman) {
    const base  = salesRepEmail ? salesRepEmail.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean) : [];
    const extra = assignedSalesman.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
    extra.forEach(e => { if (!base.includes(e)) base.push(e); });
    obj["SalesRep"] = base.join(", ");
  }
  return obj;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
  });
  return obj;
}

function appendObj(sheet, obj) {
  const headers = sheet.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ""));
  sheet.appendRow(headers.map(h => (obj[h] !== undefined ? obj[h] : "")));
}

function setCustomerType(ss, customerId, customerName, newType) {
  const sheet = ss.getSheetByName("Customers");
  if (!sheet) return;
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idIdx   = headers.findIndex(h => h.includes("id"));
  const nameIdx = headers.findIndex(h => h === "customername" || h === "customer");
  const typeIdx = headers.findIndex(h => h === "customer type" || h === "customertype");
  if (typeIdx === -1) return;
  for (let i = 1; i < data.length; i++) {
    const rowId   = String(data[i][idIdx]   || "").trim();
    const rowName = String(data[i][nameIdx] || "").trim().toLowerCase();
    const isMatch = (customerId   && rowId   === customerId.trim()) ||
                    (customerName && rowName === customerName.toLowerCase().trim());
    if (isMatch) {
      sheet.getRange(i + 1, typeIdx + 1).setValue(newType);
      return;
    }
  }
}

function setColumnByID(sheet, id, columnName, value) {
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().replace(/\s+/g, ""));
  const idIdx   = headers.indexOf("ID");
  const colIdx  = headers.indexOf(columnName);
  if (idIdx === -1 || colIdx === -1) return;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      return;
    }
  }
}

function lookupUserName(ss, email) {
  const userSheet = ss.getSheetByName("Users");
  if (!userSheet) return "";
  const data     = userSheet.getDataRange().getValues();
  const headers  = data[0].map(h => h.toString().toLowerCase().trim());
  const emailIdx = headers.indexOf("email");
  const nameIdx  = headers.indexOf("username");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
      return data[i][nameIdx] || "";
    }
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────
// ASSIGNMENT — writes to Customers + Assignments sheet + emails
// ─────────────────────────────────────────────────────────────────

function assignCustomerToRep(ss, customerId, customerName, toEmail, toName, byEmail, byName) {
  const customerSheet = ss.getSheetByName("Customers");
  if (customerSheet) {
    const data      = customerSheet.getDataRange().getValues();
    const headers   = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx     = headers.findIndex(h => h.includes("id"));
    const nameIdx   = headers.findIndex(h => h === "customername" || h === "customer");
    const repNameIdx = headers.findIndex(h => h === "salesperson name" || h === "salespersonname");

    for (let i = 1; i < data.length; i++) {
      const rowId   = data[i][idIdx]?.toString().trim();
      const rowName = data[i][nameIdx]?.toString().trim().toLowerCase();
      const isMatch = (customerId   && rowId   === customerId.trim()) ||
                      (customerName && rowName === customerName.toLowerCase().trim());
      if (!isMatch) continue;

      let assignedIdx = headers.findIndex(h => h === "assignedsalesman" || h === "assigned salesman");
      if (assignedIdx === -1) {
        const lastCol = data[0].length + 1;
        customerSheet.getRange(1, lastCol).setValue("AssignedSalesman");
        assignedIdx = lastCol - 1;
      }
      const existing = String(data[i][assignedIdx] || "").trim();
      const emails   = existing
        ? existing.split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean)
        : [];
      if (!emails.includes(toEmail.toLowerCase())) emails.push(toEmail.toLowerCase());
      customerSheet.getRange(i + 1, assignedIdx + 1).setValue(emails.join(", "));
      if (repNameIdx !== -1 && toName) customerSheet.getRange(i + 1, repNameIdx + 1).setValue(toName);
      break;
    }
  }

  // Log the assignment
  const sheet = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
  appendObj(sheet, {
    ID:              "asg_" + new Date().getTime(),
    CustomerID:      customerId,
    CustomerName:    customerName,
    AssignedToEmail: toEmail,
    AssignedToName:  toName,
    AssignedByEmail: byEmail,
    AssignedByName:  byName,
    Date:            new Date(),
    Acknowledged:    false
  });

  // Send assignment notification emails
  const appUrl = getAppUrl();
  sendAssignmentEmails(customerName, toEmail, toName, byName || byEmail, appUrl);

  return { status: "Success" };
}

/**
 * Emails the newly assigned rep + Simon + CW about the account switch.
 * The rep gets the styled HTML version; Simon/CW get a plain internal note.
 */
function sendAssignmentEmails(customerName, toEmail, toName, assignedBy, appUrl) {
  const repFirstName = (toName || toEmail.split("@")[0]).split(" ")[0];

  // ── Email to the newly assigned rep (styled) ──────────────────
  const repPlain = [
    "Hi " + repFirstName + ",",
    "",
    "You've been assigned a new account in Sunlite CRM.",
    "",
    "Account: " + customerName,
    "Assigned by: " + assignedBy,
    "",
    "Log in to view it: " + appUrl,
    "",
    "— Sunlite CRM"
  ].join("\n");

  const repHtml = buildAssignmentEmail(repFirstName, customerName, assignedBy, appUrl);

  try {
    MailApp.sendEmail(toEmail,
      "You've been assigned: " + customerName,
      repPlain,
      { htmlBody: repHtml, name: "Sunlite CRM" }
    );
  } catch(err) {
    Logger.log("Assignment rep email failed: " + err.toString());
  }

  // ── Internal note to Simon + CW ───────────────────────────────
  const internalBody = [
    "Account assignment in Sunlite CRM:",
    "",
    "Account:      " + customerName,
    "Assigned to:  " + (toName || toEmail) + " <" + toEmail + ">",
    "Assigned by:  " + assignedBy,
    "",
    "Please switch this account to " + (toName || toEmail) + " in the internal system.",
    "",
    "— Sunlite CRM (automated)"
  ].join("\n");

  try {
    MailApp.sendEmail(
      ASSIGNMENT_CC.join(","),
      "CRM Assignment — please switch " + customerName + " to " + (toName || toEmail),
      internalBody,
      { name: "Sunlite CRM" }
    );
  } catch(err) {
    Logger.log("Assignment CC email failed: " + err.toString());
  }
}

// ─────────────────────────────────────────────────────────────────
// GMAIL SYNC
// ─────────────────────────────────────────────────────────────────

function syncNewCustomerEmails() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
  const logSheet  = ss.getSheetByName("Log")       || ss.getSheetByName("Logs");
  if (!custSheet || !logSheet) return;

  const custData    = custSheet.getDataRange().getValues();
  const custHeaders = custData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const emailIdx    = custHeaders.indexOf("email")         !== -1 ? custHeaders.indexOf("email") :
                      custHeaders.indexOf("customeremail") !== -1 ? custHeaders.indexOf("customeremail") : -1;
  const nameIdx     = custHeaders.indexOf("customername")  !== -1 ? custHeaders.indexOf("customername") :
                      custHeaders.indexOf("customer")      !== -1 ? custHeaders.indexOf("customer") : 1;
  const idIdx       = custHeaders.indexOf("id") !== -1 ? custHeaders.indexOf("id") : 0;

  const customerMap = {};
  for (let i = 1; i < custData.length; i++) {
    const email = emailIdx >= 0 ? String(custData[i][emailIdx]).toLowerCase().trim() : "";
    if (email && email.includes("@")) {
      customerMap[email] = { name: String(custData[i][nameIdx] || ""), id: String(custData[i][idIdx] || "") };
    }
  }

  const logData    = logSheet.getDataRange().getValues();
  const logHeaders = logData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const notesIdx   = logHeaders.indexOf("notes");
  const logged     = {};
  for (let i = 1; i < logData.length; i++) {
    const m = String(logData[i][notesIdx] || "").match(/\[gmail-id:([^\]]+)\]/);
    if (m) logged[m[1]] = true;
  }

  const threads = GmailApp.search("newer_than:2d", 0, 100);
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const msgId = msg.getId();
      if (logged[msgId]) return;
      const fromRaw   = msg.getFrom();
      const fromMatch = fromRaw.match(/<(.+?)>/);
      const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).toLowerCase().trim();
      const customer  = customerMap[fromEmail];
      if (!customer) return;

      const lh2 = logSheet.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ""));
      logSheet.appendRow(lh2.map(h => {
        if (h === "Timestamp")    return msg.getDate();
        if (h === "UserEmail")    return "gmail-auto";
        if (h === "CustomerName") return customer.name;
        if (h === "CustomerID")   return customer.id;
        if (h === "Notes")        return "[gmail-auto] [gmail-id:" + msgId + "] " +
                                         msg.getSubject() + "\n" +
                                         msg.getPlainBody().substring(0, 400).replace(/\n+/g, " ");
        if (h === "LogType")      return "Email";
        if (h === "Type")         return "Email";
        if (h === "NewEmail")     return fromEmail;
        return "";
      }));
    });
  });
  Logger.log("syncNewCustomerEmails complete");
}

// ─────────────────────────────────────────────────────────────────
// DAILY DIGEST
// ─────────────────────────────────────────────────────────────────

function dailyNotifications() {
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return; // skip weekends

  const APP_URL = getAppUrl();
  const tz      = Session.getScriptTimeZone();
  const ss      = SpreadsheetApp.getActiveSpreadsheet();

  const logSheet     = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
  const handoffSheet = ss.getSheetByName("CSHandoffs");
  const userSheet    = ss.getSheetByName("Users");
  const custSheet    = ss.getSheetByName("Customers");
  if (!logSheet || !userSheet) { Logger.log("Missing Log or Users sheet"); return; }

  // Rep map: email → { name, role }
  const userData  = userSheet.getDataRange().getValues();
  const uHeaders  = userData[0].map(h => h.toString().toLowerCase().trim());
  const uEmailIdx = uHeaders.indexOf("email");
  const uNameIdx  = uHeaders.indexOf("username");
  const uRoleIdx  = uHeaders.indexOf("role");
  const repMap    = {};
  for (let i = 1; i < userData.length; i++) {
    const email = String(userData[i][uEmailIdx] || "").toLowerCase().trim();
    const name  = String(userData[i][uNameIdx]  || "").trim();
    const role  = String(userData[i][uRoleIdx]  || "").toLowerCase().trim();
    if (email) repMap[email] = { name: name || email.split("@")[0], role };
  }

  const todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  Logger.log("Today: " + todayStr);

  // Follow-ups due today
  const logData    = logSheet.getDataRange().getValues();
  const logHeaders = logData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const repNameIdx   = logHeaders.indexOf("repname") !== -1 ? logHeaders.indexOf("repname") : logHeaders.indexOf("salesrep");
  const userEmailIdx = logHeaders.indexOf("salesrepemail") !== -1 ? logHeaders.indexOf("salesrepemail")
                     : logHeaders.indexOf("useremail")     !== -1 ? logHeaders.indexOf("useremail")
                     : logHeaders.indexOf("email");
  const followIdx  = logHeaders.indexOf("followupdate") !== -1 ? logHeaders.indexOf("followupdate") : logHeaders.indexOf("followup");
  Logger.log("followIdx=" + followIdx + " repNameIdx=" + repNameIdx + " userEmailIdx=" + userEmailIdx);

  const followUpsByRep = {};
  if (followIdx !== -1) {
    for (let i = 1; i < logData.length; i++) {
      const raw = logData[i][followIdx];
      if (!raw) continue;
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) continue;
      const dStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
      if (dStr !== todayStr) continue;

      const repRaw   = String(logData[i][repNameIdx]   || "").trim();
      const emailRaw = String(logData[i][userEmailIdx] || "").toLowerCase().trim();
      let repEmail   = emailRaw;
      if (repRaw && !repRaw.includes("@")) {
        const found = Object.keys(repMap).find(e => repMap[e].name.toLowerCase() === repRaw.toLowerCase());
        if (found) repEmail = found;
      }
      if (!repEmail || !repEmail.includes("@")) {
        Logger.log("Row " + i + " — could not resolve rep (repRaw=" + repRaw + " emailRaw=" + emailRaw + ")");
        continue;
      }
      Logger.log("Follow-up today → " + repEmail);
      followUpsByRep[repEmail] = (followUpsByRep[repEmail] || 0) + 1;
    }
  }

  // Open CS tasks
  const tasksByRep = {};
  if (handoffSheet) {
    const hData    = handoffSheet.getDataRange().getValues();
    const hHeaders = hData[0].map(h => h.toString().replace(/\s+/g, ""));
    const hRepIdx  = hHeaders.indexOf("RepEmail");
    const hAckIdx  = hHeaders.indexOf("Acknowledged");
    for (let i = 1; i < hData.length; i++) {
      if (String(hData[i][hAckIdx] || "").toLowerCase() === "true") continue;
      const repEmail = String(hData[i][hRepIdx] || "").toLowerCase().trim();
      if (!repEmail || !repEmail.includes("@")) continue;
      tasksByRep[repEmail] = (tasksByRep[repEmail] || 0) + 1;
    }
  }

  // Overdue visits
  const visitsDueByRep = {};
  if (custSheet) {
    const cData    = custSheet.getDataRange().getValues();
    const cHeaders = cData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
    const cRepIdx      = cHeaders.findIndex(h => h.includes("salesrepemail") || h.includes("salesrep") || h === "rep");
    const cAssignedIdx = cHeaders.findIndex(h => h === "assignedsalesman" || h === "assignedsalesmanager");
    const cFreqIdx     = cHeaders.findIndex(h => h.includes("visitfrequency") || h === "frequency");
    const cLastIdx     = cHeaders.findIndex(h => h.includes("lastcontact") || h === "lastcontactdate");
    const cActiveIdx   = cHeaders.findIndex(h => h === "activestatus" || h === "active" || h === "status");
    const freqDays     = { weekly: 7, biweekly: 14, monthly: 30 };
    const todayMs      = new Date().getTime();

    for (let i = 1; i < cData.length; i++) {
      if (cActiveIdx !== -1) {
        const active = String(cData[i][cActiveIdx] || "").toLowerCase();
        if (active === "false" || active === "no" || active === "inactive") continue;
      }
      const freq = String(cData[i][cFreqIdx] || "").toLowerCase().trim();
      if (!freqDays[freq]) continue;
      const lastRaw = cData[i][cLastIdx];
      if (!lastRaw) continue;
      const lastDate = lastRaw instanceof Date ? lastRaw : new Date(lastRaw);
      if (isNaN(lastDate.getTime())) continue;
      const daysSince = Math.floor((todayMs - lastDate.getTime()) / 86400000);
      if (daysSince < freqDays[freq]) continue;

      const repField      = cRepIdx      !== -1 ? String(cData[i][cRepIdx]      || "") : "";
      const assignedField = cAssignedIdx !== -1 ? String(cData[i][cAssignedIdx] || "") : "";
      const emails = (repField + "," + assignedField)
        .split(/[,;\s]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes("@"));

      emails.forEach(repEmail => {
        const rep = repMap[repEmail];
        if (!rep) return;
        const role = rep.role;
        if (role === "admin" || role === "owner" || role === "administrator") return;
        visitsDueByRep[repEmail] = (visitsDueByRep[repEmail] || 0) + 1;
      });
    }
  }

  // Send one email per rep
  const allReps = new Set(
    Object.keys(followUpsByRep).concat(Object.keys(tasksByRep)).concat(Object.keys(visitsDueByRep))
  );
  Logger.log("Reps to notify: " + allReps.size);

  allReps.forEach(repEmail => {
    const rep      = repMap[repEmail] || { name: repEmail.split("@")[0], role: "" };
    const fuCount  = followUpsByRep[repEmail]  || 0;
    const tskCount = tasksByRep[repEmail]      || 0;
    const visCount = visitsDueByRep[repEmail]  || 0;

    const blocks = [];
    if (fuCount  > 0) blocks.push('<div style="font-size:28px;font-weight:800;color:#2563eb;margin-bottom:8px;">' + fuCount  + " follow-up"  + (fuCount  > 1 ? "s" : "") + " due today</div>");
    if (visCount > 0) blocks.push('<div style="font-size:28px;font-weight:800;color:#16a34a;margin-bottom:8px;">' + visCount + " visit"      + (visCount > 1 ? "s" : "") + " overdue</div>");
    if (tskCount > 0) blocks.push('<div style="font-size:28px;font-weight:800;color:#d93838;margin-bottom:8px;">' + tskCount + " open CS task" + (tskCount > 1 ? "s" : "") + "</div>");

    const htmlBody = `
<div style="background:#f8f9fa;padding:30px 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #eef0f2;padding:36px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
    <div style="margin-bottom:28px;">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b18543;background:#fdf6ec;padding:4px 10px;border-radius:20px;">☀️ Sunlite CRM</span>
      <h2 style="margin:14px 0 6px;font-size:20px;color:#111;font-weight:700;">Good morning, ${rep.name}</h2>
      <p style="margin:0;font-size:14px;color:#666;">Here's what needs your attention today.</p>
    </div>
    <div style="background:#fafafa;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
      ${blocks.join('<div style="height:8px;"></div>')}
    </div>
    <div style="text-align:center;">
      <a href="${APP_URL}" style="background:#111;color:#fff;text-decoration:none;padding:14px 32px;font-size:15px;font-weight:700;border-radius:10px;display:inline-block;">Open Sunlite CRM →</a>
    </div>
    <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px;margin-bottom:0;">Automated daily digest — do not reply.</p>
  </div>
</div>`;

    const subjectParts = [];
    if (fuCount  > 0) subjectParts.push(fuCount  + " follow-up"  + (fuCount  > 1 ? "s" : "") + " due today");
    if (visCount > 0) subjectParts.push(visCount + " visit"      + (visCount > 1 ? "s" : "") + " overdue");
    if (tskCount > 0) subjectParts.push(tskCount + " CS task"    + (tskCount > 1 ? "s" : ""));
    const subject  = "☀️ Sunlite Digest: " + subjectParts.join(" · ");
    const bodyText = "Hi " + rep.name + ",\n\n" + subjectParts.join("\n") + "\n\nLog in: " + APP_URL;

    try {
      MailApp.sendEmail({ to: repEmail, subject: subject, body: bodyText, htmlBody: htmlBody });
      Logger.log("Sent digest to " + repEmail);
    } catch(err) {
      Logger.log("Digest FAILED for " + repEmail + ": " + err.toString());
    }
  });

  Logger.log("dailyNotifications done — " + allReps.size + " processed");
}

// ─────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────

function emailShell(headerLabel, bodyContent) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <tr>
        <td style="background:#f59e0b;padding:28px 32px;text-align:center;">
          <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">sunlite</span>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${headerLabel}</p>
        </td>
      </tr>

      <tr><td style="padding:32px;">${bodyContent}</td></tr>

      <tr>
        <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#aaa;">Sunlite CRM · Automated notification — do not reply.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function accountCard(customerName) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Account</p>
        <p style="margin:0;font-size:18px;font-weight:900;color:#111;">${customerName}</p>
      </td></tr>
    </table>`;
}

function ctaButton(label, url) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr><td style="background:#f59e0b;border-radius:10px;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">${label}</a>
      </td></tr>
    </table>`;
}

// Notify rep: CS logged activity on their account
function buildNotifyEmail(repName, customerName, activityType, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:15px;color:#111;">Hi ${repName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">A new <strong>${activityType}</strong> was logged on one of your accounts.</p>
    ${accountCard(customerName)}
    ${ctaButton("View in Sunlite CRM →", appUrl)}`;
  return emailShell("CRM Notification", body);
}

function buildPlainNotify(repName, customerName, activityType, appUrl) {
  return [
    "Hi " + repName + ",",
    "",
    "A new " + activityType + " was logged on account: " + customerName + ".",
    "",
    "Log in to see the details: " + appUrl,
    "",
    "— Sunlite CRM"
  ].join("\n");
}

// Task reminder: nudge rep about open CS handoff
function buildTaskReminderEmail(custName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:15px;color:#111;">Hi,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">You have an <strong>open task</strong> waiting on the following account. Log in to take action.</p>
    ${accountCard(custName)}
    ${ctaButton("Open My Tasks →", appUrl)}`;
  return emailShell("Task Reminder", body);
}

function buildPlainTaskReminder(custName, appUrl) {
  return [
    "Hi,",
    "",
    "Just a reminder — there's an open task waiting for you on account: " + custName + ".",
    "",
    "Log in to review and complete it: " + appUrl,
    "",
    "— Sunlite CRM"
  ].join("\n");
}

// Assignment: rep is being given a new account
function buildAssignmentEmail(repFirstName, customerName, assignedBy, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:15px;color:#111;">Hi ${repFirstName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
      You've been assigned a new account in Sunlite CRM by <strong>${assignedBy}</strong>.
    </p>
    ${accountCard(customerName)}
    ${ctaButton("View Account →", appUrl)}`;
  return emailShell("New Account Assignment", body);
}
