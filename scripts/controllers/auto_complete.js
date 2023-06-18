import express from "express";
import MiniSearch from 'minisearch'
import {EMAIL_PAIRS} from "./auth.js";

const router = express.Router();

export {router as default};

let miniSearch = new MiniSearch({
    fields: ['name', 'email_prefix'], // fields to index for full-text search
    storeFields: ['name', 'email'], // fields to return with search results
    searchOptions: {fuzzy: 0.3, prefix: true},
})

let id = 0;
miniSearch.addAllAsync(EMAIL_PAIRS.map(a => ({...a, email_prefix: a.email.split("@")[0], id: id++})))

router.post("/get_users", fetchAutocomplete);

async function fetchAutocomplete(req, res) {
    // console.log("Fetching autocomplete results with body", req.body);
    let query = req.body?.query?.replace(/@.*/, "");
    let results = miniSearch.search(query);
    return res.send(JSON.stringify(results.map(a => ({name: a.name, email: a.email}))));
}