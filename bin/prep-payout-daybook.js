const fs = require("fs/promises");
const path = require("path");

(async function() {
    const csvData = await fs.readFile(path.join(__dirname, "statement-012023.csv"), "utf8");
    const rows = csvData.split("\n");
    const transformedRows = rows
        .slice(1)
        .flatMap((r, i) => {
            const [disbursementDate, settlementAmount, paidOutAmount, feeAmount, expectedReceivedDate] = r.split(",");
            if(!expectedReceivedDate || !feeAmount || !paidOutAmount ||!settlementAmount) {
                return [];
            }

            console.log("r", r, r.split(","));

            const date = prepDate(expectedReceivedDate);

            return [
                ["F", "D2024-" + (i + 1), date, "Udbetaling fra betalingsleverandør", 5710, "", paidOutAmount, "", 5820],
                ["F", "D2024-" + (i + 1), date, "Gebyr til betalingsleverandør",      2320, "", "", feeAmount, 5820],
            ];
        })
        .map((rowData) => rowData.join(","))
        .join("\n");

    const headings = "Type,Bilag nr.,Dato,Tekst,Konto nr.,Momskode,Debet,Kredit,Modkonto nr.";
        
    const preppedData = `${headings}\n${transformedRows}`;

    await fs.writeFile(path.join(__dirname, "prepped-payouts.csv"), preppedData, "utf8");
})().catch((e) => console.error("Hey", e));

function prepDate(d) {
    return d.split(".").map((n) => n.padStart(2, '0')).join("-");
}
