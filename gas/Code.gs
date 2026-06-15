/**
 * GOOGLE APPS SCRIPT — SUNLITE CRM HUB
 * Version 3.6 — Fix column lookup using space-stripped headers; exact name match to Users sheet
 *
 * Handles: login, customers (own + all), logs (read/save/delete), users,
 *          quick links, email send, gmail sync, customer-email update,
 *          account assignment + alerts, and access requests.
 *
 * Deploy: Deploy > New deployment > Web app > Execute as "Me",
 *         Access "Anyone". Copy the /exec URL into the app's VITE_GAS_URL.
 *         Re-deploy a NEW VERSION every time you change this file.
 *
 * Sheets used (auto-created when missing): Customers, Users, Log,
 *         "quick links", Assignments, AccessRequests.
 */

function doGet(e) {
  if (!e || !e.parameter) {
    return createJsonResponse({
      error: "Run via the deployed Web App URL, not the editor.",
      help: "Deploy > New Deployment > Web App."
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  const userEmail = (e.parameter.userEmail || "").toString().toLowerCase().trim();

  try {
    // ───────────────────────────────────────── 1. LOGIN
    if (action === "login") {
      const password = (e.parameter.password || "").toString().trim();
      const userSheet = ss.getSheetByName("Users");
      const userData = userSheet.getDataRange().getValues();
      const headers = userData[0].map(h => h.toString().toLowerCase().trim());
      const emailIdx = headers.indexOf("email");
      const passIdx = headers.indexOf("password");
      const roleIdx = headers.indexOf("role");
      const nameIdx = headers.indexOf("username");

      const userRow = userData.slice(1).find(row =>
        row[emailIdx]?.toString().toLowerCase().trim() === userEmail &&
        row[passIdx]?.toString().trim() === password
      );
      if (!userRow) return createJsonResponse({ error: "Invalid credentials" });

      return createJsonResponse({
        status: "Success",
        userRole: userRow[roleIdx],
        userName: userRow[nameIdx] || userEmail.split('@')[0]
      });
    }

    // ───────────────────────────────────────── 2. GET CUSTOMERS (rep-filtered)
    if (action === "getCustomers") {
      const customerSheet = ss.getSheetByName("Customers");
      const data = customerSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);

      const userSheet = ss.getSheetByName("Users");
      const userData = userSheet.getDataRange().getValues();
      const userRecord = userData.find(row => row[0]?.toString().toLowerCase().trim() === userEmail);
      const role = userRecord ? userRecord[1] : "Salesman";
      const isAdmin = (role === "Admin" || role === "Administrator" || role === "Owner");

      const repIndex = headers.findIndex(h => {
        const head = h.toString().toLowerCase();
        return head.includes("sales rep email") || head.includes("salesrep") || head.includes("rep");
      });
      const assignedIdx = headers.findIndex(h =>
        h.toString().toLowerCase().trim() === "assignedsalesman" || h.toString().toLowerCase().trim() === "assigned salesman"
      );

      const filtered = isAdmin ? rows : rows.filter(row => {
        const repField = (row[repIndex] || "").toString().toLowerCase();
        const assignedField = assignedIdx !== -1 ? (row[assignedIdx] || "").toString().toLowerCase() : "";
        const combined = [repField, assignedField].filter(Boolean).join(",");
        const repList = combined.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean);
        return repList.includes(userEmail) || repList.includes("open");
      });

      return createJsonResponse(filtered.map(row => mapCustomerRow(headers, row)));
    }

    // ───────────────────────────────────────── 2b. GET ALL CUSTOMERS (owner/admin, no filter)
    if (action === "getAllCustomers") {
      const customerSheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
      if (!customerSheet) return createJsonResponse([]);
      const data = customerSheet.getDataRange().getValues();
      if (data.length < 2) return createJsonResponse([]);
      const headers = data[0];
      const rows = data.slice(1).filter(row => row.some(c => c !== "" && c !== null));
      return createJsonResponse(rows.map(row => mapCustomerRow(headers, row)));
    }

    // ───────────────────────────────────────── 3. GET LOGS
    if (action === "getLogs") {
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (!logSheet) return createJsonResponse([]);
      const data = logSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1).filter(row => row[0] !== "" && row[0] !== null);
      const result = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          const key = h.toString().replace(/\s+/g, '');
          obj[key] = row[i] instanceof Date ? row[i].toISOString() : row[i];
        });
        return obj;
      });
      return createJsonResponse(result.reverse().slice(0, 2000));
    }

    // ───────────────────────────────────────── 4. SAVE LOG
    if (action === "saveLog") {
      const logSheet = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      const customerSheet = ss.getSheetByName("Customers");

      const timestamp = new Date();
      const customerName = e.parameter.CustomerName || "";
      const customerID   = e.parameter.CustomerID || "";
      const notes        = e.parameter.Notes || e.parameter.summary || "";
      const followUpDate = e.parameter.FollowUpDate || "";
      const priority     = e.parameter.Priority || "";
      // Prefer the clean lowercase 'type', fall back to the legacy LogType label
      const cleanType    = (e.parameter.type || "").toString().toLowerCase().trim();
      const logType      = e.parameter.LogType || typeLabel(cleanType) || "Note";
      const id           = e.parameter.id || ("log_" + timestamp.getTime());
      const visitFrequency = e.parameter.VisitFrequency || "";
      const visitStartDate = e.parameter.VisitStartDate || "";

      // A. Append to the history log — header-driven, case-insensitive matching
      const repName = e.parameter.repName || e.parameter.RepName || "";
      const logHeaders = logSheet.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
      const row = logHeaders.map(h => {
        if (h === "id")                                                    return id;
        if (h === "timestamp" || h === "date")                             return timestamp;
        if (h === "useremail" || h === "email" || h === "remail" || h === "salesrepemail") return userEmail;
        if (h === "repname" || h === "salesrep" || h === "rep" || h === "salesperson") return repName || userEmail;
        if (h === "username" || h === "user" || h === "loggedby")          return repName || userEmail;
        if (h === "customername" || h === "customer")                      return customerName;
        if (h === "customerid" || h === "custid")                          return customerID;
        if (h === "notes" || h === "summary" || h === "note")              return notes;
        if (h === "reason")                                                return e.parameter.Reason || "";
        if (h === "newemail")                                              return e.parameter.NewEmail || "";
        if (h === "followupdate" || h === "followup")                      return followUpDate;
        if (h === "logtype" || h === "type" || h === "activitytype")       return logType;
        if (h === "priority")                                              return priority;
        return "";
      });
      logSheet.appendRow(row);

      // B. Update the master Customers record (priority / follow-up / routing)
      const custData = customerSheet.getDataRange().getValues();
      const custHeaders = custData[0].map(h => h.toString().toLowerCase().trim());
      const idIdx       = custHeaders.findIndex(h => h.includes("id"));
      const nameIdx     = custHeaders.findIndex(h => h === "customername" || h === "customer");
      const priorityIdx = custHeaders.findIndex(h => h === "priority");
      const followIdx   = custHeaders.findIndex(h => h.includes("followup") || h.includes("follow up"));
      const freqIdx     = custHeaders.findIndex(h => h.includes("visit frequency") || h === "visitfrequency" || h === "frequency");
      const dateIdx     = custHeaders.findIndex(h => h.includes("route commencement date") || h.includes("visit start date"));

      for (let i = 1; i < custData.length; i++) {
        const rowId = custData[i][idIdx]?.toString().trim();
        const rowName = custData[i][nameIdx]?.toString().trim().toLowerCase();
        const isMatch = (customerID && rowId === customerID.trim()) ||
                        (customerName && rowName === customerName.toLowerCase().trim());
        if (isMatch) {
          if (priorityIdx !== -1 && priority) customerSheet.getRange(i + 1, priorityIdx + 1).setValue(priority);
          if (followIdx !== -1 && followUpDate) customerSheet.getRange(i + 1, followIdx + 1).setValue(followUpDate);
          if (freqIdx !== -1 && visitFrequency) customerSheet.getRange(i + 1, freqIdx + 1).setValue(visitFrequency);
          if (dateIdx !== -1 && visitStartDate) customerSheet.getRange(i + 1, dateIdx + 1).setValue(visitStartDate);
          // Always update LastContactDate so the dashboard re-evaluates urgency on next sync
          const lastContactIdx = custHeaders.findIndex(h =>
            h.includes("lastcontact") || h === "last contact date" || h === "lastcontactdate" || h === "date of last contact"
          );
          if (lastContactIdx !== -1) {
            customerSheet.getRange(i + 1, lastContactIdx + 1).setValue(new Date());
          }
          break;
        }
      }

      // C. If notifyRep=true, email the assigned rep and write to CSHandoffs sheet
      const notifyRep = (e.parameter.notifyRep || "").toLowerCase() === "true";
      if (notifyRep) {
        // Use space-stripped headers for column lookup
        const custHeadersNS = custData[0].map(h => h.toString().replace(/\s+/g,'').toLowerCase());
        const custIdIdx2   = custHeadersNS.findIndex(h => h === "customerid" || h === "custid" || h === "id");
        const custNameIdx2 = custHeadersNS.findIndex(h => h === "customername" || h === "customer");
        const repNameColIdx = custHeadersNS.findIndex(h => h === "salespersonname" || h === "repname");

        let repDisplayName = "";
        for (let i = 1; i < custData.length; i++) {
          const rowId   = String(custData[i][custIdIdx2] || "").trim();
          const rowName = String(custData[i][custNameIdx2] || "").trim().toLowerCase();
          const isMatch = (customerID && rowId === customerID.trim()) ||
                          (customerName && rowName === customerName.toLowerCase().trim());
          if (isMatch) {
            repDisplayName = repNameColIdx !== -1 ? String(custData[i][repNameColIdx] || "").trim() : "";
            break;
          }
        }

        // Match salesperson name exactly to Users sheet userName → get their email
        let firstRepEmail = "";
        let firstRepName = repDisplayName;
        if (repDisplayName) {
          const userSheet = ss.getSheetByName("Users");
          if (userSheet) {
            const userData = userSheet.getDataRange().getValues();
            const uHeaders = userData[0].map(h => h.toString().toLowerCase().trim());
            const uEmailIdx = uHeaders.indexOf("email");
            const uNameIdx  = uHeaders.indexOf("username");
            const repLower  = repDisplayName.toLowerCase();
            for (let i = 1; i < userData.length; i++) {
              const uName = String(userData[i][uNameIdx] || "").trim().toLowerCase();
              if (uName && uName === repLower) {
                firstRepEmail = String(userData[i][uEmailIdx] || "").toLowerCase().trim();
                firstRepName  = String(userData[i][uNameIdx] || "").trim();
                break;
              }
            }
          }
        }
        if (firstRepEmail) {
          const csRepName = repName || userEmail;
          const activityLabel = {
            call: "Phone Call", visit: "Field Visit", email: "Email", note: "Note"
          }[cleanType] || logType || "Activity";
          const now = new Date();
          const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "MMM d, yyyy 'at' h:mm a");
          const emailBody = [
            "Hi " + firstRepName + ",",
            "",
            "A new activity was logged on your account — " + customerName + ":",
            "",
            "Type: " + activityLabel,
            "Date: " + dateStr,
            "Logged by: " + csRepName,
            "",
            notes,
            "",
            "— Sunlite CRM"
          ].join("\n");
          try {
            MailApp.sendEmail(firstRepEmail, "New " + activityLabel + " logged — " + customerName, emailBody);
          } catch(mailErr) {
            Logger.log("Rep email failed: " + mailErr.toString());
          }
          // Write to CSHandoffs sheet
          const handoffSheet = getOrCreateSheet(ss, "CSHandoffs",
            ["ID", "CustomerID", "CustomerName", "RepEmail", "CSName", "Date", "Notes", "Acknowledged", "ActivityType"]);
          handoffSheet.appendRow([
            Utilities.getUuid(),
            customerID || customerName,
            customerName,
            firstRepEmail.toLowerCase(),
            csRepName,
            now,
            notes,
            "false",
            logType || "note"
          ]);
        }
      }

      return createJsonResponse({ status: "Success" });
    }

    // ───────────────────────────────────────── 4b. DELETE LOG
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
      return createJsonResponse({ status: "Success" });
    }

    // ───────────────────────────────────────── 5. GET USERS
    if (action === "getUsers") {
      const userSheet = ss.getSheetByName("Users");
      const data = userSheet.getDataRange().getValues();
      const headers = data[0];
      const result = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let key = h.toString().trim();
          if (key.toLowerCase() === "username") key = "name";
          if (key.toLowerCase() === "email") key = "email";
          if (key.toLowerCase() === "role") key = "role";
          obj[key] = row[i];
        });
        return obj;
      });
      return createJsonResponse(result);
    }

    // ───────────────────────────────────────── 6. GET QUICK LINKS
    if (action === "getQuickLinks") {
      const sheet = ss.getSheetByName("quick links");
      if (!sheet) return createJsonResponse([]);
      const data = sheet.getDataRange().getValues();
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

    // ───────────────────────────────────────── 7. SEND EMAIL
    if (action === "sendEmail") {
      const to       = e.parameter.to       || "";
      const subject  = e.parameter.subject  || "(no subject)";
      const body     = e.parameter.body     || "";
      const custName = e.parameter.customerName || "";
      const custId   = e.parameter.customerId   || custName;
      if (!to) return createJsonResponse({ status: "Error", message: "No recipient" });

      GmailApp.sendEmail(to, subject, body, {
        name: "Sunlite Sales",
        replyTo: e.parameter.userEmail || ""
      });

      const logSheet2 = ss.getSheetByName("Log") || ss.getSheetByName("Logs");
      if (logSheet2) {
        const headers = logSheet2.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ""));
        const row = headers.map(h => {
          if (h === "Timestamp")    return new Date();
          if (h === "UserEmail")    return e.parameter.userEmail || "";
          if (h === "CustomerName") return custName;
          if (h === "CustomerID")   return custId;
          if (h === "Notes")        return "[Email sent] " + subject + "\n" + body.substring(0, 300);
          if (h === "LogType")      return "Email";
          if (h === "Type")         return "Email";
          if (h === "NewEmail")     return to;
          return "";
        });
        logSheet2.appendRow(row);
      }
      return createJsonResponse({ status: "Success" });
    }

    // ───────────────────────────────────────── 8. GMAIL SYNC
    if (action === "syncEmails") {
      syncNewCustomerEmails();
      return createJsonResponse({ status: "ok" });
    }

    // ───────────────────────────────────────── 9. UPDATE CUSTOMER EMAIL (contacts JSON)
    if (action === "updateCustomerEmail") {
      const sheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, '').toLowerCase());
      const idIdx = headers.indexOf("id");
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

    // ───────────────────────────────────────── 10. ASSIGN CUSTOMER → rep
    if (action === "assignCustomer") {
      const result = assignCustomerToRep(
        ss,
        e.parameter.customerId || "",
        e.parameter.customerName || "",
        (e.parameter.toEmail || "").toLowerCase().trim(),
        e.parameter.toName || "",
        (e.parameter.byEmail || "").toLowerCase().trim(),
        e.parameter.byName || ""
      );
      return createJsonResponse(result);
    }

    // ───────────────────────────────────────── 11. GET ASSIGNMENTS (for a rep)
    if (action === "getAssignments") {
      const repEmail = (e.parameter.repEmail || userEmail || "").toLowerCase().trim();
      const sheet = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      const out = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.AssignedToEmail || "").toLowerCase().trim() === repEmail &&
            String(obj.Acknowledged).toLowerCase() !== "true") {
          out.push(obj);
        }
      }
      return createJsonResponse(out.reverse());
    }

    // ───────────────────────────────────────── 12. ACKNOWLEDGE ASSIGNMENT
    if (action === "acknowledgeAssignment") {
      const sheet = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
      setColumnByID(sheet, e.parameter.id || "", "Acknowledged", true);
      return createJsonResponse({ status: "Success" });
    }

    // ───────────────────────────────────────── 13. REQUEST ACCESS
    if (action === "requestAccess") {
      const sheet = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const id = "req_" + new Date().getTime();
      appendObj(sheet, {
        ID: id,
        CustomerID: e.parameter.customerId || "",
        CustomerName: e.parameter.customerName || "",
        RequesterEmail: (e.parameter.requesterEmail || "").toLowerCase().trim(),
        RequesterName: e.parameter.requesterName || "",
        Date: new Date(),
        Status: "pending"
      });
      // Email admins
      const requesterName = e.parameter.requesterName || e.parameter.requesterEmail || "A rep";
      const customerName2 = e.parameter.customerName || e.parameter.customerId || "an account";
      const body = [
        requesterName + " has requested access to: " + customerName2,
        "",
        "Requester: " + (e.parameter.requesterEmail || ""),
        "Account: " + customerName2,
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

    // ───────────────────────────────────────── 14. GET ACCESS REQUESTS (admin)
    if (action === "getAccessRequests") {
      const sheet = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      const out = [];
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.Status || "pending").toLowerCase() === "pending") out.push(obj);
      }
      return createJsonResponse(out.reverse());
    }

    // ───────────────────────────────────────── 15. RESOLVE ACCESS REQUEST (grant/deny)
    if (action === "resolveAccessRequest") {
      const sheet = getOrCreateSheet(ss, "AccessRequests", ACCESS_HEADERS);
      const id = e.parameter.id || "";
      const grant = String(e.parameter.grant).toLowerCase() === "true";
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      for (let i = 1; i < data.length; i++) {
        const obj = rowToObj(headers, data[i]);
        if (String(obj.ID).trim() === id.trim()) {
          setColumnByID(sheet, id, "Status", grant ? "granted" : "denied");
          if (grant) {
            const repName = lookupUserName(ss, obj.RequesterEmail) || obj.RequesterName || "";
            assignCustomerToRep(ss, obj.CustomerID, obj.CustomerName,
              String(obj.RequesterEmail).toLowerCase().trim(), repName, "admin", "Admin");
          }
          return createJsonResponse({ status: "Success" });
        }
      }
      return createJsonResponse({ status: "Success" });
    }

    // ───────────────────────────────────────── 16. ADD CONTACT (new person at an account)
    if (action === "addContact") {
      const customerName = e.parameter.customerName || "";
      const firstName    = e.parameter.firstName || "";
      const lastName     = e.parameter.lastName || "";
      const position     = e.parameter.position || "";
      const contactEmail = e.parameter.contactEmail || "";
      const addedBy      = e.parameter.addedBy || userEmail;
      const addedDate    = new Date().toLocaleDateString("en-US");

      // Write to Contacts sheet
      const contactSheet = getOrCreateSheet(ss, "Contacts",
        ["ID", "CustomerName", "FirstName", "LastName", "Position", "Email", "AddedBy", "Date"]);
      contactSheet.appendRow([
        Utilities.getUuid(),
        customerName, firstName, lastName, position, contactEmail, addedBy, addedDate
      ]);

      // Email Garry
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || contactEmail;
      const body = [
        "A new contact was added to " + customerName + ":",
        "",
        "Name: "     + fullName,
        "Position: " + (position || "—"),
        "Email: "    + (contactEmail || "—"),
        "",
        "Added by: " + addedBy,
        "Date: "     + addedDate,
      ].join("\n");
      try {
        MailApp.sendEmail("garry@sunshinelighting.com",
          "New Contact Added — " + customerName + ": " + fullName, body);
      } catch(mailErr) {
        Logger.log("Email send failed: " + mailErr.toString());
      }

      return createJsonResponse({ status: "ok" });
    }

    // ── CS HANDOFFS
    if (action === "getCSHandoffs") {
      const repEmail = (e.parameter.repEmail || userEmail || "").toLowerCase().trim();
      const sheet = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse([]);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      const out = [];
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
      const id = e.parameter.id || "";
      const sheet = ss.getSheetByName("CSHandoffs");
      if (!sheet) return createJsonResponse({ error: "No CSHandoffs sheet" });
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
      const idIdx2 = headers.indexOf("ID");
      for (let i = 1; i < data.length; i++) {
        if (idIdx2 >= 0 && String(data[i][idIdx2]) === id) {
          const ackIdx = headers.indexOf("Acknowledged");
          if (ackIdx >= 0) sheet.getRange(i + 1, ackIdx + 1).setValue("true");
          return createJsonResponse({ status: "ok" });
        }
      }
      return createJsonResponse({ error: "Not found" });
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

// ───────────────────────────────────────── HELPERS

var ASSIGNMENT_HEADERS = ["ID", "CustomerID", "CustomerName", "AssignedToEmail",
  "AssignedToName", "AssignedByEmail", "AssignedByName", "Date", "Acknowledged"];
var ACCESS_HEADERS = ["ID", "CustomerID", "CustomerName", "RequesterEmail",
  "RequesterName", "Date", "Status"];

// Maps a clean lowercase activity type to the human label stored in the sheet
function typeLabel(t) {
  switch (t) {
    case "call":  return "Phone Call";
    case "visit": return "Visit";
    case "email": return "Email";
    case "note":  return "Note";
    default:      return "";
  }
}

// Normalise a Customers row into the keys the app expects
function mapCustomerRow(headers, row) {
  const obj = {};
  let salesRepEmail = "";
  let assignedSalesman = "";
  headers.forEach((h, i) => {
    let key = h.toString().trim();
    const low = key.toLowerCase();
    if (low === "customer id") key = "ID";
    if (low === "customername") key = "Customer";
    if (low.includes("sales rep email")) { key = "SalesRep"; salesRepEmail = String(row[i] || "").trim(); }
    if (low === "assignedsalesman" || low === "assigned salesman") { assignedSalesman = String(row[i] || "").trim(); }
    if (low === "salesperson name") key = "SalespersonName";
    if (low === "last order date") key = "LastOrderDate";
    if (low === "visit frequency") key = "VisitFrequency";
    if (low === "visit start date") key = "VisitStartDate";
    const cleanKey = key.replace(/\s+/g, '_');
    const v = row[i];
    obj[cleanKey] = v instanceof Date ? v.toISOString() : v;
  });
  // Merge SalesRepEmail + AssignedSalesman so ownsAccount sees both
  if (assignedSalesman) {
    const base = salesRepEmail ? salesRepEmail.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean) : [];
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
  const headers = sheet.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ''));
  sheet.appendRow(headers.map(h => (obj[h] !== undefined ? obj[h] : "")));
}

function setColumnByID(sheet, id, columnName, value) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().replace(/\s+/g, ''));
  const idIdx = headers.indexOf("ID");
  const colIdx = headers.indexOf(columnName);
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
  const data = userSheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const emailIdx = headers.indexOf("email");
  const nameIdx = headers.indexOf("username");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
      return data[i][nameIdx] || "";
    }
  }
  return "";
}

// Writes the new rep onto the Customers row AND logs an assignment record
function assignCustomerToRep(ss, customerId, customerName, toEmail, toName, byEmail, byName) {
  const customerSheet = ss.getSheetByName("Customers");
  if (customerSheet) {
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx = headers.findIndex(h => h.includes("id"));
    const nameIdx = headers.findIndex(h => h === "customername" || h === "customer");
    const repIdx = headers.findIndex(h => h.includes("sales rep email") || h.includes("salesrep") || h.includes("rep"));
    const repNameIdx = headers.findIndex(h => h === "salesperson name" || h === "salespersonname");
    for (let i = 1; i < data.length; i++) {
      const rowId = data[i][idIdx]?.toString().trim();
      const rowName = data[i][nameIdx]?.toString().trim().toLowerCase();
      const isMatch = (customerId && rowId === customerId.trim()) ||
                      (customerName && rowName === customerName.toLowerCase().trim());
      if (isMatch) {
        // Write to AssignedSalesman column (safe to write — no formula)
        // Find or create the column
        let assignedIdx = headers.findIndex(h => h === "assignedsalesman" || h === "assigned salesman");
        if (assignedIdx === -1) {
          // Add the column header
          const lastCol = data[0].length + 1;
          customerSheet.getRange(1, lastCol).setValue("AssignedSalesman");
          assignedIdx = lastCol - 1;
        }
        const existing = String(data[i][assignedIdx] || "").trim();
        const emails = existing ? existing.split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean) : [];
        if (!emails.includes(toEmail.toLowerCase())) emails.push(toEmail.toLowerCase());
        customerSheet.getRange(i + 1, assignedIdx + 1).setValue(emails.join(", "));
        if (repNameIdx !== -1 && toName) customerSheet.getRange(i + 1, repNameIdx + 1).setValue(toName);
        break;
      }
    }
  }

  const sheet = getOrCreateSheet(ss, "Assignments", ASSIGNMENT_HEADERS);
  appendObj(sheet, {
    ID: "asg_" + new Date().getTime(),
    CustomerID: customerId,
    CustomerName: customerName,
    AssignedToEmail: toEmail,
    AssignedToName: toName,
    AssignedByEmail: byEmail,
    AssignedByName: byName,
    Date: new Date(),
    Acknowledged: false
  });
  return { status: "Success" };
}

/**
 * Scans Gmail for emails from customer addresses (last 2 days) and logs
 * them as gmail-auto entries. Wire to a daily time-driven trigger.
 */
function syncNewCustomerEmails() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const custSheet = ss.getSheetByName("Customers") || ss.getSheets()[0];
  const logSheet  = ss.getSheetByName("Log")       || ss.getSheetByName("Logs");
  if (!custSheet || !logSheet) return;

  const custData    = custSheet.getDataRange().getValues();
  const custHeaders = custData[0].map(h => h.toString().replace(/\s+/g, "").toLowerCase());
  const emailIdx    = custHeaders.indexOf("email")        !== -1 ? custHeaders.indexOf("email") :
                      custHeaders.indexOf("customeremail") !== -1 ? custHeaders.indexOf("customeremail") : -1;
  const nameIdx     = custHeaders.indexOf("customername") !== -1 ? custHeaders.indexOf("customername") :
                      custHeaders.indexOf("customer")     !== -1 ? custHeaders.indexOf("customer") : 1;
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
  const logged = {};
  for (let i = 1; i < logData.length; i++) {
    const m = String(logData[i][notesIdx] || "").match(/\[gmail-id:([^\]]+)\]/);
    if (m) logged[m[1]] = true;
  }

  const threads = GmailApp.search("newer_than:2d", 0, 100);
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const msgId = msg.getId();
      if (logged[msgId]) return;
      const fromRaw = msg.getFrom();
      const fromMatch = fromRaw.match(/<(.+?)>/);
      const fromEmail = (fromMatch ? fromMatch[1] : fromRaw).toLowerCase().trim();
      const customer = customerMap[fromEmail];
      if (!customer) return;

      const logHeaders2 = logSheet.getDataRange().getValues()[0].map(h => h.toString().replace(/\s+/g, ""));
      const row = logHeaders2.map(h => {
        if (h === "Timestamp")    return msg.getDate();
        if (h === "UserEmail")    return "gmail-auto";
        if (h === "CustomerName") return customer.name;
        if (h === "CustomerID")   return customer.id;
        if (h === "Notes")        return "[gmail-auto] [gmail-id:" + msgId + "] " + msg.getSubject() + "\n" +
                                         msg.getPlainBody().substring(0, 400).replace(/\n+/g, " ");
        if (h === "LogType")      return "Email";
        if (h === "Type")         return "Email";
        if (h === "NewEmail")     return fromEmail;
        return "";
      });
      logSheet.appendRow(row);
    });
  });
  Logger.log("syncNewCustomerEmails complete");
}
