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
    // {
    //     header: "product-name",
    //     label: "Item Name",
    //     required: true,
    //     unique: false,
    //     type: "string"
    // },

    {
        header: "sku",
        label: "Item Name",
        required: true,
        unique: false,
        type: "string"
    },
    {
        header: "quantity-purchased",
        label: "Item Quantity",
        required: true,
        unique: false,
        type: "number",
        aliases: ["quantity", "item quantity", "quantity purchased"]
    },
    {
        header: "item-rate",
        label: "Item Rate",
        required: false,
        unique: false,
        type: "number"
    },
    // {
    //     header: "per",
    //     label: "Per (extracted UOM)",
    //     required: false,
    //     unique: false,
    //     type: "string"
    // },
    {
        header: "per",
        label: "Per",
        required: false,
        unique: false,
        type: "string",
        transform: () => "nos"
    },
    // {
    //     header: "total-quantity",
    //     label: "Total Quantity",
    //     required: false,
    //     unique: false,
    //     type: "string"
    // },
    {
        header: "item-price-gst",
        label: "Item Basic Amount",
        type: "number",
        required: false
    },
    {
        header: "cgst",
        label: "CGST",
        required: false,
        unique: false,
        type: "number"
    },
    {
        header: "sgst",
        label: "SGST",
        required: false,
        unique: false,
        type: "number"
    },
    {
        header: "igst",
        label: "IGST",
        required: false,
        unique: false,
        type: "number"
    },
    // {
    //     header: "item-tax",
    //     label: "Item Tax",
    //     required: true,
    //     unique: false,
    //     type: "number"
    // },
    {
        header: "item-price",
        label: "Total bill Value",
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
        type: "string",
        aliases: ["ship country", "shipping country"],
        transform: (value) => {
            const country = String(value).trim().toUpperCase();

            const countries = {
                "IN": "India",
                "IND": "India",
                "INDIA": "India",
                "US": "United States",
                "USA": "United States",
                "UK": "United Kingdom",
                "GB": "United Kingdom"
            };

            return countries[country] || value;
        }
    }
    // {
    //     header: "gstin",
    //     label: "GSTIN",
    //     required: false,
    //     unique: false,
    //     type: "string"
    // }


];



/* Display settings (not column settings) */
const PREVIEW_LIMIT = 1000;      // rows shown in the preview table
const MAX_ERRORS_SHOWN = 100;   // errors listed in the error panel
const SELLER_STATE = "west bengal";
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

// item rate calculate 

function calculateItemRate(basePrice, quantity) {
    const price = Number(basePrice) || 0;
    const qty = Number(quantity) || 0;

    if (qty <= 0) return 0;

    return Number((price / qty).toFixed(2));
}


// date formating 
function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (isNaN(date)) return "";

    return `${date.getUTCDate()}-${date.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC"
    }).toUpperCase()}-${date.getUTCFullYear()}`;
}

// tax calculate  should add here---

// ---------- GST DISTRIBUTION ----------
function splitItemTax(totalTax, sellerState, shippingState) {

    totalTax = Number(totalTax) || 0;

    const seller = String(sellerState)
        .trim()
        .toLowerCase();

    const buyer = String(shippingState)
        .trim()
        .toLowerCase();

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (seller === buyer) {

        cgst = Number((totalTax / 2).toFixed(2));

        // Remaining amount avoids rounding mismatch
        sgst = Number((totalTax - cgst).toFixed(2));

    } else {

        igst = Number(totalTax.toFixed(2));

    }

    return {
        cgst,
        sgst,
        igst
    };
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
// per calculated function here -----
function extractUOM(description) {
    if (!description) return "";

    const text = String(description)
        .toLowerCase()
        .replace(/,/g, " ");

    // Find actual measurement
    const pattern =
        /(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|kg|grams?|gms?|gm|g|milliliters?|millilitres?|ml|litres?|liters?|ltrs?|ltr|l|pieces?|pcs?|pc)\b/i;

    const match = text.match(pattern);

    if (!match) return "1 pcs";

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    // Normalize UOM
    const unitMap = {
        kg: "kg",
        kgs: "kg",
        kilogram: "kg",
        kilograms: "kg",

        g: "gm",
        gm: "gm",
        gms: "gm",
        gram: "gm",
        grams: "gm",

        ml: "ml",
        milliliter: "ml",
        milliliters: "ml",
        millilitre: "ml",
        millilitres: "ml",

        l: "ltr",
        ltr: "ltr",
        ltrs: "ltr",
        liter: "ltr",
        liters: "ltr",
        litre: "ltr",
        litres: "ltr",

        pc: "pcs",
        pcs: "pcs",
        piece: "pcs",
        pieces: "pcs"
    };

    // Detect packaging multiplier
    let packCount = 1;

    const packagingPatterns = [
        /\b(?:pack|box|carton|case|set)\s+of\s+(\d+)\b/i,
        /\b(\d+)\s*(?:boxes?|packs?|cartons?|cases?|sets?)\b/i,
        /\b(\d+)\s*[x×]\s*(?=\d)/i
    ];

    for (const packagingPattern of packagingPatterns) {
        const packMatch = text.match(packagingPattern);

        if (packMatch) {
            packCount = parseInt(packMatch[1], 10);
            break;
        }
    }

    // Calculate actual contents per purchased pack
    const total = value * packCount;

    return `${Number(total.toFixed(3))} ${unitMap[unit]}`;
}

/*----total quantity--*/
function extractTotalQuantity(quantity, per) {
    if (!quantity || !per) return "";

    const match = String(per).match(/^(\d+(?:\.\d+)?)\s*(kg|gm|ml|ltr|pcs)$/i);

    if (!match) return "";

    const total = Number(quantity) * Number(match[1]);
    const unit = match[2].toLowerCase();

    return `${Number(total.toFixed(3))} ${unit}`;
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
    const seen = SCHEMA.map(() => new Map());

    rows.forEach((raw, index) => {
        const rowNum = index + 2;
        const values = [];
        const errors = [];

        mapping.forEach(({ col, actual }, c) => {
            const original = actual === null || raw[actual] == null
                ? ""
                : String(raw[actual]);

            // Preserve original Amazon shipping status
            const shippingStatus = raw["ship-status"] || "";

            let value = original.trim();

            // item acual price calculate ----
            function calculateBasePrice(totalPrice, itemTax) {
                return Number((Number(totalPrice) - Number(itemTax)).toFixed(2));
            }


            if (col.header === "item-price-gst") {

                const totalPrice = raw["item-price"] || 0;
                const itemTax = raw["item-tax"] || 0;

                value = calculateBasePrice(totalPrice, itemTax).toFixed(2);
            }

            // APPLY SCHEMA TRANSFORMATION-----
            if (col.transform) {
                value = col.transform(value);
            }

            // AUTOMATIC ITEM GST EXTRACTION
            // ---------- AUTOMATIC GST DISTRIBUTION ----------

            if (["cgst", "sgst", "igst"].includes(col.header)) {

                const totalTax = Number(raw["item-tax"]) || 0;

                const shippingState = raw["ship-state"] || "";

                const taxSplit = splitItemTax(
                    totalTax,
                    SELLER_STATE,
                    shippingState
                );

                value = taxSplit[col.header].toFixed(2);
            }


            // FORMAT PURCHASE DATE
            if (col.header === "purchase-date") {
                value = formatDate(value);
            }

            // per shows always nos ---------
            if (col.header === "per") {
                value = "nos";
            }

            // AUTOMATIC UOM EXTRACTION ----------
            if (col.header === "weight") {
                const productDescription = raw["product-name"] || "";
                value = extractUOM(productDescription);
            }

            // AUTOMATIC TOTAL QUANTITY ---------
            if (col.header === "total-quantity") {
                const quantity = Number(
                    raw["quantity-purchased"] ??
                    raw["quantity"] ??
                    0
                );
                const perIndex = SCHEMA.findIndex(
                    item => item.header === "weight"
                );

                const per = values[perIndex] || "";

                value = extractTotalQuantity(quantity, per);
            }
            // AUTOMATIC ITEM RATE CALCULATION -----------
            if (col.header === "item-rate") {

                const totalPrice = Number(raw["item-price"]) || 0;
                const itemTax = Number(raw["item-tax"]) || 0;
                const quantity = Number(
                    raw["quantity-purchased"] ??
                    raw["quantity"] ??
                    0
                );

                const basePrice = calculateBasePrice(totalPrice, itemTax);

                value = calculateItemRate(basePrice, quantity).toFixed(2);
            }

            values.push(value);

            if (value === "") {
                if (actual !== null && col.required) {
                    errors.push(`${labelOf(col)} is required but empty`);
                }
                return;
            }

            const typeError = checkType(value, col);

            if (typeError) {
                errors.push(`${labelOf(col)} ${typeError} (found "${value}")`);
            }

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

        // GET ORIGINAL AMAZON ORDER STATUS
        const orderStatus = String(raw["order-status"] || "Not Available").trim();

        // ADD ORDER STATUS TO INVALID ERROR MESSAGE
        if (errors.length) {
            errors.unshift(`Order Status: ${orderStatus}`);
        }

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
function downloadExcel(records, includeErrors, suffix) {

    // Excel column headers
    // const fields = SCHEMA.map(col => col.header);
    const fields = SCHEMA.map(col => col.label || col.header);

    if (includeErrors) {
        fields.push("Validation Errors");
    }

    // Prepare Excel data
    const data = records.map(record => {

        const values = record.values.map((value, index) => {

            const col = SCHEMA[index];

            // Convert numeric columns into actual Excel numbers
            if (
                ["number", "integer"].includes(col.type) &&
                value !== "" &&
                Number.isFinite(Number(value))
            ) {
                return Number(value);
            }

            // Keep other values as text
            return value;
        });

        if (includeErrors) {
            values.push(
                "Row " + record.rowNum + ": " + record.errors.join("; ")
            );
        }

        return values;
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([
        fields,
        ...data
    ]);

    // Set column widths
    worksheet["!cols"] = fields.map(field => ({
        wch: Math.max(field.length + 5, 18)
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Validated Data"
    );

    // Generate filename
    const base = (state.file?.name || "data")
        .replace(/\.(csv|xlsx|xls)$/i, "");

    const filename = `${base}_${suffix}.xlsx`;

    // Download Excel file
    XLSX.writeFile(workbook, filename);
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
el.downloadValidBtn.addEventListener("click", () =>
    downloadExcel(state.validRows, false, "valid")
);

el.downloadInvalidBtn.addEventListener("click", () =>
    downloadExcel(state.invalidRows, true, "invalid")
);
el.tabValid.addEventListener("click", () => { state.activeTab = "valid"; renderPreview(); });
el.tabInvalid.addEventListener("click", () => { state.activeTab = "invalid"; renderPreview(); });

renderSchemaChips();
const initialProblem = checkSchema();
if (initialProblem) setStatus("error", initialProblem);



// backend connected -------

async function testBackend() {
    try {
        const response = await fetch(
            "http://localhost:8000/api/health"
        );

        const data = await response.json();

        console.log("Backend response:", data);

    } catch (error) {
        console.error("Backend connection failed:", error);
    }
}

testBackend();