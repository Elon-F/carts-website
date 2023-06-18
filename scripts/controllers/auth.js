import express from "express";
import passport from "passport";
import User from "../data_models/userModel.js";
import Cart from "../data_models/cartModel.js";
import Config from "../data_models/configModel.js";
import EmailDB from "../data_models/emailDataModel.js";
import {UserTypes} from "../data_models/userModel.js";
import {Strategy as GoogleStrategy} from "passport-google-oauth2";
import {config} from "dotenv";
import {google} from "googleapis";

// Keyfile
import key from "../../google_key.json" assert {type: "json"};
import {connect} from "../db.js";

config();

const GOOGLE_CLIENT_ID = process.env.GGL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GGL_CLIENT_SECRET;

const EMAIL_DOMAIN = "@" + process.env.DOMAIN;
const valid_email_domain_regex = new RegExp(`^.*${EMAIL_DOMAIN}$`)
const API_AUTH_EMAIL = process.env.API_AUTH_EMAIL;
const scopes = ['https://www.googleapis.com/auth/admin.directory.user.readonly', 'https://www.googleapis.com/auth/admin.directory.group.readonly', 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly'];

const router = express.Router();

let whitelist;
let login_page;

export {module as default, EMAIL_PAIRS};

router.use(passport.initialize());
router.use(passport.session()); // adding the passport middleware to automatically deserialise the user properties into requests, accessed at req.user by later functions

let userProfile;

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
}, verify));

// Redirect the user to the Google signin page (this is reached by pressing the fancy button)
router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}));

function setCookieStuff(req, res, next) {
    let type = req?.user?.type;
    if (type === "STAFF") {
        req.session.cookie.maxAge = 86400000 / 2; // 12 hours
    } else if (type === "ADMIN") {
        req.session.cookie.maxAge = 86400000;
    }
    next()
}

// Retrieve user data using the access token received
router.get('/auth/google/callback', passport.authenticate('google', {}), setCookieStuff, function (req, res, next) {
    // on success
    if (req.user) {
        return res.redirect("/carts");
    } else {
        return res.redirect("/");
    }
});

router.get('/success', (req, res) => res.send(userProfile));
router.get('/error', (req, res) => res.send("error logging in"));

router.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect("/");
    });
});

// require auth on all non-root paths. placed here to avoid interfering with authentication, just in case. not checked.
router.use(isAuthenticated)
/**
 * Avoid storing too much data in the session cookie. if i start loading up the user with things, offload most of the infrequently used content to the database
 * and keep only id / name / pfp link in the session.
 */
passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});

const EMAIL_PAIRS = await getAllUsersInOrgUnits(["מורים", "מנהלה"]);

function module(wl = ['/', '/login'], lp = '/') {
    whitelist = wl;
    login_page = lp;
    return router;
}

/** https://www.passportjs.org/concepts/authentication/strategies/#verify-function
 * handles local data related to that user.
 */
async function verify(request, accessToken, refreshToken, profile, done) {
    try {
        let email = profile.emails[0].value;
        if (!email.match(valid_email_domain_regex)) {
            console.log(`Logged invalid attempt using address: ${email}`)
            request.session.message = "Your account is not authorized to access this resource";
            return done(null, false);
        }

        let existingUser = await User.findOne({'google.id': profile.id}); // look through mongo to find a user with the same google id
        if (existingUser) { // if the user exists, we return the user object
            console.log(`${existingUser.google.name} logged in`);
            // if undefined, recheck org chart for new permissions
            if (existingUser.type === "UNDEFINED") {
                existingUser.type = await getPermissionGroup(existingUser.google.email);
                existingUser.save();
            }
            return done(null, existingUser);
        }

        console.log('New user detected!');

        const newUser = new User({ // create a new user
            google: {id: profile.id, name: profile.displayName, email: email, picture: profile.picture},
            type: await getPermissionGroup(email)
        });
        await newUser.save(); // save to disk
        return done(null, newUser); // and return the new user
    } catch (error) {
        return done(error, false)
    }
}

function isAuthenticated(req, res, next) {
    req.session.message = undefined;
    if (req.isAuthenticated() || whitelist.includes(req.url)) {
        return next();
    }
    console.log(`blocked attempt to access ${req.url}`)
    req.session.message = "You cannot access this resource unless you are logged in."
    res.redirect(login_page);
}

/**
 * returns the highest attainable permission group for the given email address, according to the org / group structure.
 * @param email_address
 * @returns {Promise<*|string|null>}
 */
async function getPermissionGroup(email_address) {
    if (!email_address.match(valid_email_domain_regex)) {
        console.log(`Cannot get user data for ${email_address}`)
        return null;
    }
    let id_dict_ou = {"id:123": "STUDENT", "id:456": "TEACHER"};
    let id_dict_groups = {"234": "TEACHER", "456": "TEACHER"};

    let id = await getUserRootOrgUnit(email_address);
    let role = id_dict_ou[id] ?? "UNDEFINED";

    let ids = await getUserGroupIds(email_address);
    ids.forEach(id => {
        let index = UserTypes.indexOf(id_dict_groups[id] ?? "UNDEFINED");
        if (index < UserTypes.indexOf(role)) { // check if the matched ID has better permission than the current role
            role = id_dict_groups[id]
        }
    });
    return role;
}

async function getUserGroupIds(email_address) {
    const auth = new google.auth.JWT({
        email: key.client_email, key: key.private_key, scopes: scopes, subject: API_AUTH_EMAIL
    })
    let result = await auth.authorize();

    const admin = await google.admin({version: 'directory_v1', auth: auth});
    try {
        const response = await admin.groups.list({userKey: email_address, maxResults: 200});
        let ids = response.data.groups.map(a => a.id);
        // console.log(response.data)
        console.log(`Email: ${email_address}, Groups: ${response.data.groups.map(a => a.name)} with ids ${ids}`)
        return ids;
    } catch (err) {
        console.log(err.errors);
    }
    return [];
}


async function getUserRootOrgUnit(email_address) {
    const auth = new google.auth.JWT({
        email: key.client_email, key: key.private_key, scopes: scopes, subject: API_AUTH_EMAIL
    })

    let result = await auth.authorize();

    // obtain the admin client
    const admin = await google.admin({version: 'directory_v1', auth: auth});
    try {
        // Check if the backend id and alias is given
        const email_response = await admin.users.get({userKey: email_address}); // data.orgUnitPath contains the path.
        let customer_id = email_response.data.customerId;
        let ouPath = email_response.data.orgUnitPath.slice(1);
        if ([...ouPath.matchAll(/\//gm)].length > 1) {
            ouPath = ouPath.slice(0, ouPath.indexOf('/'));
        }
        if (ouPath === "") ouPath = "/";
        const response = await admin.orgunits.get({customerId: customer_id, orgUnitPath: ouPath});
        let ouId = response.data.orgUnitId;
        console.log(`Email: ${email_address}, root OU: ${ouPath} with ${ouId}`)
        return ouId;
    } catch (err) {
        console.log(err.errors);
    }
}

async function getAllUsersInOrgUnits(units) {
    let full_list = [];
    await connect();
    let db_users = await EmailDB.find({}).lean().exec();
    if (db_users.length !== 0) return db_users;
    const auth = new google.auth.JWT({
        email: key.client_email, key: key.private_key, scopes: scopes, subject: API_AUTH_EMAIL
    })
    let result = await auth.authorize();

    const admin = await google.admin({version: 'directory_v1', auth: auth});
    let nextPageToken = "";
    do {
        try {
            const response = await admin.users.list({
                domain: process.env.DOMAIN,
                maxResults: 200, ...((nextPageToken ?? "") !== "" && {pageToken: nextPageToken})
            });
            nextPageToken = response.data.nextPageToken;
            let ids = response.data.users.map(a => ({name: a.name.fullName, email: a.primaryEmail, ou: a.orgUnitPath}));
            full_list.push(...ids)
        } catch (err) {
            console.log("fail", err.errors);
            console.log(err)
        }
    } while (nextPageToken ?? "" !== "");
    let users = full_list.filter(x => (units.some((unit) => x.ou.includes(unit))));
    EmailDB.insertMany(users);
    return users;
}

async function readJson(path, cb) {
    fs.readFile(require.resolve(path), (err, data) => {
        if (err) {
            cb(err)
        } else cb(null, JSON.parse(data))
    })
}

