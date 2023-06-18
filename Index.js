'use strict';
// Imports
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import {fileURLToPath} from 'url';
import path, {dirname} from 'path';
import cartsRouter from "./scripts/controllers/carts.js";
import getAuthRouter from "./scripts/controllers/auth.js";
import session from "express-session";
import * as db from "./scripts/db.js";
import {config as ConfigEnvVariables} from "dotenv";
import connectMongoDBSession from "connect-mongodb-session";

ConfigEnvVariables();

const MongoDBStore = connectMongoDBSession(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const port = 80;
const store = new MongoDBStore({
    uri: db.dbUrl,
    databaseName: 'CartsWebsite',
    collection: 'session_data',
    ttl: 14 * 24 * 60 * 60, // 14 days * 24h before culling the session - in prod set to 24h, this is just to monitor usage.
});

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(session({
    resave: true, saveUninitialized: true, secret: process.env.SESSION_SECRET, cookie: {maxAge: 10 * 60 * 60 * 1000, sameSite: "Lax"},
    store: store, rolling: true,
}));


app.set('views', [path.join(__dirname, 'views/pages'), path.join(__dirname, 'views')]);
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(populateLocals);

// Root page: the fancy login page.
app.get("/", (req, res) => {
    // pass the message as a parameter to the render target, and delete the message
    let msg = req?.session?.message;
    if (msg) req.session.message = undefined;
    if (req?.session?.passport?.user?.type === "TEACHER") return res.redirect("/carts");
    res.render("home", {context: msg});
});

const authRouter = getAuthRouter(['/', '/login', 'global.css', '/favicon.ico', 'assets/*'], '/');
app.use(authRouter);

app.use('/carts', cartsRouter);

app.get('*', function (req, res) {
    req.session.message = `The requested page (${req.url}) was not found`;
    res.redirect('/');
});

async function startServer() {
    try {
        await db.connect();
        app.listen(port, function () {
            console.log(`Server running on port ${port}.`);
        });
    } catch (error) {
        console.error("Failed to connect to the database:", error);
        process.exit(1);
    }
}

function populateLocals(req, res, next) {
    res.locals.pfp = req?.session?.passport?.user?.google?.picture;
    res.locals.user = req?.session?.passport?.user;
    return next();
}

startServer();