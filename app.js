/*   CSV VALIDATOR & COLUMN EXTRACTOR */
const SCHEMA = [
    {
        header: "purchase-date",
        label: "Purchase Date",
        required: false,
        unique: false,
        type: "date",
        aliases: ["purchase date", "Purchase Date"]
    },
    {
        header: "voucher-number",
        label: "Voucher Number",
        required: false,
        unique: false,
        type: "string",
        aliases: ["my voucher number", "voucher number"]
    },
    {
        header: "order-id",
        label: "Amazon Order ID",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "party-name",
        label: "Party Name",
        required: false,
        unique: false,
        type: "string",
        aliases: ["party name", "party name"]
    },
    {
        header: "sales-ledger",
        label: "Sales Ledger",
        required: false,
        unique: false,
        type: "string",
        aliases: ["sales Ledger", "sales ledger"]
    },
    {
        header: "product-name",
        label: "Item Name",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "sku",
        label: "SKU",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "quantity-purchased",
        label: "Item Quantity",
        required: true,
        unique: false,
        type: "number"
    },
    {
        header: "item-price",
        label: "Item Rate",
        required: true,
        unique: false,
        type: "number"
    },
    {
        header: "item-tax",
        label: "Item Tax",
        required: true,
        unique: false,
        type: "number"
    },
    {
        header: "shipping-price",
        label: "Shipping Price",
        required: true,
        unique: false,
        type: "number"
    },
    {
        header: "shipping-tax",
        label: "Shipping Tax",
        required: true,
        unique: false,
        type: "number"
    },
    {
        header: "ship-state",
        label: "ship State",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "ship-postal-code",
        label: "Ship Postal Code",
        required: true,
        unique: false,
        type: "numbers"
    },
    {
        header: "ship-country",
        label: "Ship Country",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "gstin",
        label: "GSTIN",
        required: false,
        unique: false,
        type: "string"
    }


];



/* Display settings (not column settings) */
const PREVIEW_LIMIT = 1000;      // rows shown in the preview table
const MAX_ERRORS_SHOWN = 100;   // errors listed in the error panel

/*  Everything below is generic  */

const $ = (id) => document.getElementById(id);
const el = {
    fileInput: $("fileInput"), fileName: $("fileName"), processBtn: $("processBtn"),
    schemaList: $("schemaList"), statusBox: $("statusBox"),
    statTotal: $("statTotal"), statValid: $("statValid"), statInvalid: $("statInvalid"),
    statSourceCols: $("statSourceCols"), statSelectedCols: $("statSelectedCols"),
    downloadValidBtn: $("downloadValidBtn"), downloadInvalidBtn: $("downloadInvalidBtn"),
    errorPanel: $("errorPanel"), errorList: $("errorList"), errorNote: $("errorNote"),
    tabValid: $("tabValid"), tabInvalid: $("tabInvalid"),
    previewNote: $("previewNote"), previewTable: $("previewTable")
};

const state = { file: null, validRows: [], invalidRows: [], activeTab: "valid" };

const normalize = (s) => {
    return String(s == null ? "" : s)
        .normalize("NFKC")
        .replace(/^\uFEFF/, "")
        .replace(/[\u200B-\u200D\u2060]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
};
const labelOf = (col) => col.label || col.header;

/* ---------- Schema sanity check and chips ---------- */
function checkSchema() {
    if (!Array.isArray(SCHEMA) || SCHEMA.length === 0) return "SCHEMA is empty. Add at least one column.";
    const seen = new Set();
    for (const col of SCHEMA) {
        if (!col || !col.header) return "Every SCHEMA entry needs a 'header'.";
        const key = normalize(col.header);
        if (seen.has(key)) return `SCHEMA lists "${col.header}" more than once.`;
        seen.add(key);
    }
    return null;
}

function renderSchemaChips() {
    el.schemaList.innerHTML = "";
    SCHEMA.forEach((col) => {
        const chip = document.createElement("span");
        chip.className = "chip" + (col.required ? " req" : "");
        const b = document.createElement("b");
        b.textContent = labelOf(col);
        chip.append(b, ` (${col.header}${col.required ? ", required" : ""}${col.unique ? ", unique" : ""}${col.type && col.type !== "string" ? ", " + col.type : ""})`);
        el.schemaList.appendChild(chip);
    });
}

/* ---------- Status helpers ---------- */
function setStatus(type, message) {
    el.statusBox.hidden = !message;
    el.statusBox.className = "status " + type;
    el.statusBox.textContent = message || "";
}

function resetResults() {
    state.validRows = [];
    state.invalidRows = [];
    el.statTotal.textContent = el.statValid.textContent = el.statInvalid.textContent = "0";
    el.statSourceCols.textContent = el.statSelectedCols.textContent = "0";
    el.downloadValidBtn.disabled = el.downloadInvalidBtn.disabled = true;
    el.tabValid.disabled = el.tabInvalid.disabled = true;
    el.errorPanel.hidden = true;
    el.errorList.innerHTML = "";
    el.previewTable.tHead.innerHTML = "";
    el.previewTable.tBodies[0].innerHTML = "";
    el.previewNote.textContent = "Upload and process a file to see a preview.";
}

/* ---------- Column matching (by header name, never by position) ---------- */
function mapColumns(sourceHeaders) {
    const lookup = new Map();

    sourceHeaders.forEach((header) => {
        const key = normalize(header);

        if (!lookup.has(key)) {
            lookup.set(key, header);
        }
    });

    const mapping = [];
    const missingRequired = [];
    const missingOptional = [];

    SCHEMA.forEach((col) => {

        const possibleNames = [
            col.header,
            col.label,
            ...(col.aliases || [])
        ];

        let actual = null;

        for (const name of possibleNames) {
            const key = normalize(name);

            if (lookup.has(key)) {
                actual = lookup.get(key);
                break;
            }
        }

        if (actual === null) {
            if (col.required) {
                missingRequired.push(col);
            } else {
                missingOptional.push(col);
            }
        }

        mapping.push({
            col,
            actual
        });
    });

    return {
        mapping,
        missingRequired,
        missingOptional
    };
}

/* ---------- Value validation ---------- */
function checkType(value, col) {
    switch (col.type) {
        case "number":
            return value !== "" && Number.isFinite(Number(value)) ? null : "must be a number";
        case "integer":
            return /^-?\d+$/.test(value) ? null : "must be a whole number";
        case "date":
            return Number.isNaN(Date.parse(value)) ? "must be a valid date" : null;
        case "email":
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "must be a valid email address";
        default:
            return null;
    }
}

function validateRows(rows, mapping) {
    const valid = [];
    const invalid = [];
    const seen = SCHEMA.map(() => new Map()); // per-column: value -> first row number

    rows.forEach((raw, index) => {
        const rowNum = index + 2; // row 1 is the header line in the source file
        const values = [];
        const errors = [];

        mapping.forEach(({ col, actual }, c) => {
            const original = actual === null || raw[actual] == null ? "" : String(raw[actual]);
            const value = original.trim();
            values.push(original);

            if (value === "") {
                if (actual !== null && col.required) errors.push(`${labelOf(col)} is required but empty`);
                return; // empty optional cell: skip other checks
            }
            const typeError = checkType(value, col);
            if (typeError) errors.push(`${labelOf(col)} ${typeError} (found "${value}")`);

            if (col.pattern && !new RegExp(col.pattern).test(value)) {
                errors.push(`${labelOf(col)} has an invalid format (found "${value}")`);
            }
            if (col.unique) {
                if (seen[c].has(value)) {
                    errors.push(`${labelOf(col)} "${value}" is a duplicate of row ${seen[c].get(value)}`);
                } else {
                    seen[c].set(value, rowNum);
                }
            }
        });

        const record = { rowNum, values, errors };
        (errors.length ? invalid : valid).push(record);
    });
    return { valid, invalid };
}

/* ---------- Preview ---------- */
function renderPreview() {
    const isValid = state.activeTab === "valid";
    const rows = isValid ? state.validRows : state.invalidRows;
    const thead = el.previewTable.tHead;
    const tbody = el.previewTable.tBodies[0];
    thead.innerHTML = "";
    tbody.innerHTML = "";

    el.tabValid.classList.toggle("active", isValid);
    el.tabInvalid.classList.toggle("active", !isValid);

    const headRow = document.createElement("tr");
    const heads = ["Row"].concat(SCHEMA.map(labelOf));
    if (!isValid) heads.push("Validation Errors");
    heads.forEach((text, i) => {
        const th = document.createElement("th");
        th.textContent = text;
        if (i === 0) th.className = "rownum";
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const shown = rows.slice(0, PREVIEW_LIMIT);
    const frag = document.createDocumentFragment();
    shown.forEach((r) => {
        const tr = document.createElement("tr");
        const num = document.createElement("td");
        num.className = "rownum";
        num.textContent = r.rowNum;
        tr.appendChild(num);
        r.values.forEach((v) => {
            const td = document.createElement("td");
            td.textContent = v;
            td.title = v;
            tr.appendChild(td);
        });
        if (!isValid) {
            const td = document.createElement("td");
            td.className = "err";
            td.textContent = r.errors.join("; ");
            tr.appendChild(td);
        }
        frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    const kind = isValid ? "valid" : "invalid";
    el.previewNote.textContent = rows.length === 0
        ? `No ${kind} rows.`
        : `Showing the first ${shown.length.toLocaleString()} of ${rows.length.toLocaleString()} ${kind} rows. Downloads include all rows.`;
}

function renderErrors() {
    el.errorList.innerHTML = "";
    const all = [];
    for (const r of state.invalidRows) {
        for (const msg of r.errors) {
            all.push(`Row ${r.rowNum}: ${msg}`);
            if (all.length >= MAX_ERRORS_SHOWN) break;
        }
        if (all.length >= MAX_ERRORS_SHOWN) break;
    }
    all.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        el.errorList.appendChild(li);
    });
    const total = state.invalidRows.reduce((n, r) => n + r.errors.length, 0);
    el.errorPanel.hidden = total === 0;
    el.errorNote.textContent = total > all.length
        ? `showing first ${all.length} of ${total.toLocaleString()}; the invalid download lists all`
        : `${total.toLocaleString()} total`;
}

/* ---------- Processing ---------- */
function processFile() {

    const schemaProblem = checkSchema();

    if (schemaProblem) {
        setStatus("error", schemaProblem);
        return;
    }

    if (!state.file) {
        setStatus("error", "Choose a file first.");
        return;
    }

    resetResults();

    el.processBtn.disabled = true;

    setStatus("info", "Reading and validating your file...");

    const file = state.file;
    const extension = file.name.split(".").pop().toLowerCase();

    // EXCEL FILE
    if (["xlsx", "xls"].includes(extension)) {

        const reader = new FileReader();

        reader.onload = function (e) {

            try {

                const workbook = XLSX.read(e.target.result, {
                    type: "array",
                    cellDates: true
                });

                const sheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json(worksheet, {
                    defval: "",
                    raw: false
                });

                const sourceHeaders = Object.keys(rows[0] || {});

                handleParsed({
                    data: rows,
                    meta: {
                        fields: sourceHeaders
                    },
                    errors: []
                });

            } catch (error) {

                el.processBtn.disabled = false;

                setStatus(
                    "error",
                    "Excel reading failed: " + error.message
                );

            }

        };

        reader.onerror = function () {
            el.processBtn.disabled = false;
            setStatus("error", "Could not read the Excel file.");
        };

        reader.readAsArrayBuffer(file);

    }

    // CSV FILE
    else if (extension === "csv") {

        Papa.parse(file, {

            header: true,
            dynamicTyping: false,
            skipEmptyLines: "greedy",
            encoding: "UTF-8",

            complete: function (results) {
                handleParsed(results);
            },

            error: function (error) {

                el.processBtn.disabled = false;

                setStatus(
                    "error",
                    "CSV reading failed: " + error.message
                );

            }

        });

    }

    else {

        el.processBtn.disabled = false;

        setStatus(
            "error",
            "Unsupported file. Please upload CSV, XLSX or XLS."
        );

    }

}

function handleParsed(results) {
    el.processBtn.disabled = false;
    const sourceHeaders = results.meta.fields || [];
    const rows = results.data || [];


    el.statSourceCols.textContent = sourceHeaders.length.toLocaleString();

    if (sourceHeaders.length === 0 || (rows.length === 0 && sourceHeaders.length <= 1 && !sourceHeaders[0])) {
        setStatus("error", "The file appears to be empty or has no header row.");
        return;
    }

    const { mapping, missingRequired, missingOptional } = mapColumns(sourceHeaders);
    if (missingRequired.length) {
        console.log("========== MISSING COLUMN DETAILS ==========");

        console.log(
            "Missing columns:",
            missingRequired.map(c => c.header)
        );

        console.log(
            "Actual CSV headers:",
            JSON.stringify(sourceHeaders, null, 2)
        );

        console.log(
            "Normalized CSV headers:",
            JSON.stringify(sourceHeaders.map(normalize), null, 2)
        );

        console.log(
            "Expected headers:",
            JSON.stringify(SCHEMA.map(c => c.header), null, 2)
        );

        console.log("=============================================");

        setStatus(
            "error",
            "Required columns not detected. Open F12 > Console and check CSV DEBUG."
        );

        return;
    }

    const { valid, invalid } = validateRows(rows, mapping);
    state.validRows = valid;
    state.invalidRows = invalid;

    el.statTotal.textContent = rows.length.toLocaleString();
    el.statValid.textContent = valid.length.toLocaleString();
    el.statInvalid.textContent = invalid.length.toLocaleString();
    el.statSelectedCols.textContent = (SCHEMA.length - missingOptional.length).toLocaleString();
    el.downloadValidBtn.disabled = valid.length === 0;
    el.downloadInvalidBtn.disabled = invalid.length === 0;
    el.tabValid.disabled = el.tabInvalid.disabled = false;

    state.activeTab = valid.length === 0 && invalid.length > 0 ? "invalid" : "valid";
    renderPreview();
    renderErrors();

    // Integrity check: no rows lost
    if (valid.length + invalid.length !== rows.length) {
        setStatus("error", "Internal error: row counts do not add up. Please report this.");
        return;
    }

    let msg = `Processed ${rows.length.toLocaleString()} rows: ${valid.length.toLocaleString()} valid, ${invalid.length.toLocaleString()} invalid.`;
    if (missingOptional.length) {
        msg += ` Optional column${missingOptional.length > 1 ? "s" : ""} not found (left empty): ${missingOptional.map((c) => c.header).join(", ")}.`;
    }
    const fieldMismatches = (results.errors || []).filter((e) => e.type === "FieldMismatch").length;
    if (fieldMismatches) msg += ` ${fieldMismatches} row(s) had an unexpected number of fields; missing cells were treated as empty.`;
    setStatus(invalid.length ? "info" : "success", msg);
}

/* ---------- Downloads ---------- */
function downloadCsv(records, includeErrors, suffix) {
    const fields = SCHEMA.map((c) => c.header);
    if (includeErrors) fields.push("Validation Errors");
    const data = records.map((r) => includeErrors ? r.values.concat(["Row " + r.rowNum + ": " + r.errors.join("; ")]) : r.values);
    const csv = Papa.unparse({ fields, data });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const base = (state.file && state.file.name ? state.file.name : "data").replace(/\.csv$/i, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${base}_${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Events ---------- */
el.fileInput.addEventListener("change", () => {
    state.file = el.fileInput.files[0] || null;
    el.fileName.textContent = state.file ? state.file.name : "No file selected";
    el.processBtn.disabled = !state.file;
    resetResults();
    setStatus("", "");
});
el.processBtn.addEventListener("click", processFile);
el.downloadValidBtn.addEventListener("click", () => downloadCsv(state.validRows, false, "valid"));
el.downloadInvalidBtn.addEventListener("click", () => downloadCsv(state.invalidRows, true, "invalid"));
el.tabValid.addEventListener("click", () => { state.activeTab = "valid"; renderPreview(); });
el.tabInvalid.addEventListener("click", () => { state.activeTab = "invalid"; renderPreview(); });

renderSchemaChips();
const initialProblem = checkSchema();
if (initialProblem) setStatus("error", initialProblem);