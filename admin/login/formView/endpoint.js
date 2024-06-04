import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
    
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formView = fs.readFileSync(path.join(__dirname, "formView.html")).toString();

export default (users) => (req, res) => {
    res.send(formView);
};
