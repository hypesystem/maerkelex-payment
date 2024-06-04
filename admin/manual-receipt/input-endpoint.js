import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
    
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputView = fs.readFileSync(path.join(__dirname, "input-view.html")).toString();
import mustache from "mustache";

export default (maerkelex) => (req, res) => {
    maerkelex.getData((error, data) => {
        if(error) {
            console.error("Something went wrong", error);
            return res.fail(500, "Something went wrong");
        }
        res.send(mustache.render(inputView, {
            ...data,
            m: data.m.filter((badge) => badge.price || badge.price == 0),
        }));
    });
};
