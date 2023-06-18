import express from "express";
import Cart from "../data_models/cartModel.js";
import Config from "../data_models/configModel.js";
import {LongReservation, SingleReservation} from "../data_models/reservationModels.js";
import {fileURLToPath} from "url";
import {dirname} from "path";
import * as DateUtils from "../dateUtils.js"
import nodemailer from "nodemailer"
import {EMAIL_PAIRS} from "./auth.js";

import key from "../../google_key.json" assert {type: "json"};
import carts_staff from "./carts_staff.js";
import carts_teacher from "./carts_teacher.js";
import crypto from "crypto";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default router;

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: {
        type: "OAuth2", serviceClient: key.client_email, privateKey: key.private_key,
    }
});

let cartTableHours = setTimeout(async () => { // TODO this is only updated on restart which is an issue.
    cartTableHours = (await Config.findOne({name: "Hours"})).data;
}); // don't even need a delay wtf lol

let all_carts = setTimeout(async () => {
    all_carts = (await Cart.find({}));
});

let clients = [];

router.use(express.json());
router.use(express.urlencoded({extended: true}));
// router.use(express.multipart());

// fun middleware to redirect render references to carts/ instead. just for fun. would be better suited to use this function to inject properties required on every render via res.locals or something
router.use(modifyRender);

router.get("/events", events);

router.use(SendInterfaceByUserType);
router.use("/teacher", carts_teacher);

router.use("/staff", carts_staff);

async function events(req, res) {
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();

    // Tell the client to retry every 10 seconds if connectivity is lost
    res.write(`retry: 10000\n\n`);

    const clientId = crypto.randomBytes(16).toString("hex");

    const newClient = {
        id: clientId,
        res
    };

    clients.push(newClient);

    req.on('close', () => {
        console.log(`${clientId} Connection closed`);
        clients = clients.filter(client => client.id !== clientId);
    });
}

async function refreshClients(date) {
    for (let client of clients) {
        client.res.write(`event: refresh\n`);
        client.res.write(`data: ${DateUtils.getDateForInputField(date)}\n\n`);
    }
    console.log("refreshed clients")
}

function modifyRender(req, res, next) {
    // grab reference of render
    let _render = res.render;
    // override logic
    res.render = function (view, options, fn) {
        // continue with original render
        _render.call(this, "carts/" + view, options, fn);
    }
    next();
}

async function SendInterfaceByUserType(req, res, next) {
    let usertype = req?.user?.type;
    switch (usertype) {
        case "ADMIN":
        case "STAFF":
            req.url = `/staff${req.path}`;
            break;
        case "TEACHER":
            req.url = `/teacher${req.path}`;
            break;
        default:
            req.session.message = "You are not authorised to access this resource."
            res.redirect("/");
            return;
    }
    next();
}

export async function UpdateLongReservations(req, res) {
    DisplayLongPanel(req, res)
}

export async function RenderEntryEditor(req, res) {
    let json_data = req.body;
    console.log("Incoming request for entry editor: ", json_data);
    // use the current date, along with cart, startrow, and endrow, to query the database for reservations.
    const {cartName, start: startRow, end: endRow} = json_data;
    let hours = Array.from(new Array(endRow - startRow), (x, i) => i + startRow);
    if (hours.length === 0) return res.end();
    const date = DateUtils.convertFromISO(json_data.date);
    const weekday = date.getDay();
    let alerts = []
    let reservation_data = await getReservationData(hours, [{name: cartName}], date)

    // longterms go into the "alerts"
    let longs = await LongReservation.find({
        date_from: {$lte: date},
        date_to: {$gte: date},
        "info.cart_name": cartName,
        "info.start": {$lt: endRow},
        "info.end": {$gt: startRow},
        day_of_week: weekday,
    }).exec();
    let longs_2 = []
    for (let hour of hours) {
        for (let r of longs) {
            if (r.info.start <= hour && hour < r.info.end) {
                alerts.push(`Overwrites long at H${hour + 1} by ${r.info.user.split('@')[0]}`);
                if (longs_2.indexOf(r) === -1) longs_2.push(r);
            }
        }
    }
    let emails = [...new Set(reservation_data.map(x => x[cartName]?.user).filter(x => x !== undefined))]

    // shorts are used to fill out the list of emails, classrooms, checkboxes, etc.
    let singles = await SingleReservation.find({
        date: date, "info.cart_name": cartName, "info.start": {$lt: endRow}, "info.end": {$gt: startRow},
    }).exec();

    let classrooms = [...new Set([...singles, ...longs_2].map(x => x.info?.classroom).filter(x => x !== undefined))];
    let notes = [...new Set([...singles, ...longs_2].map(x => x.info?.notes).filter(x => x !== undefined))];
    let dangers = [];
    let infos = [];
    let checkboxes_each = [...new Set([...singles, ...longs_2].map(x => x.info?.checkboxes).filter(x => x !== undefined))];
    let checkboxes = {}
    for (let check of checkboxes_each) {
        for (let prop in check.toObject()) { // for each property
            if (typeof (check[prop]) === "boolean") checkboxes[prop] = (checkboxes[prop] ?? false) || check[prop]; else checkboxes[prop] = (checkboxes[prop] ?? []).concat(check[prop]);
        }
    }

    for (let k in checkboxes) {
        if (Array.isArray(checkboxes[k])) checkboxes[k] = checkboxes[k].join(", ");
    }

    console.log("hours", hours)

    hours = (hours.length > 1 ? ": " : " at ") + `${hours[0] + 1}` + (hours.length > 1 ? ` to ${hours.slice(-1)[0] + 1}` : "")

    // render the square template with the data
    res.render('partials/entry_editor_staff', {
        edit: longs_2.length + singles.length, emails: emails, classrooms: classrooms, checkboxes: checkboxes, notes: notes, alerts: alerts, dangers: dangers, infos: infos, hours: hours,
    });
}

export async function RenderCartsMatrix(req, res) {
    let json_data = req.body;
    let date = DateUtils.convertFromISO(json_data.date);
    res.render("partials/cart_matrix", {tableData: await getTableData(all_carts, date)});
}

export async function updateLongReservations(req, res) {
    const body = req.body;
    console.log("Update reservation", body);
    console.log("Before", await LongReservation.findById(body._id).exec())
    let _id = body._id;
    delete body._id;
    let info_data = {}
    for (let i in body) {
        info_data[`info.${i}`] = body[i];
    }
    if (!!(_id)) {
        console.log("Update data", {...body, ...info_data})
        await LongReservation.findByIdAndUpdate(_id, {...body, ...info_data}).exec(); // so this is kind of a weird hack... doesn't support checkboxes
    } else {
        let new_res = await new LongReservation({classroom: "", ...body, ...info_data}).save();
        console.log("Creating new long record", new_res)
        _id = new_res._id;
    }
    console.log("After", await LongReservation.findById(_id).exec());

    // force refresh on all clients
    refreshClients("ALL")

    return res.send();
}

export async function updateReservations(req, res) {
    const body = req.body;
    if (req?.user?.type === "TEACHER") {
        body.emails = req?.session?.passport?.user?.google?.email;
    }

    console.log("Update reservation", body);
    let date = DateUtils.convertFromISO(body["date"]);

    // TODO  first, delete all other reservations within the given range (convert to inactive). modify getReservationData to account for this and return other useful information like overwritten and whatnot
    await SingleReservation.updateMany({
        date: date, "info.cart_name": body.cartName, "info.start": {$lt: body.end}, "info.end": {$gt: body.start},
    }, {"info.disabled": true});


    // then, create a new reservation on the given date rate, for the given person with the given parameters. TODO add the remaining data and maybe dynamically insert it from the request instead of manuallu
    let reservation = {
        date: date, info: {
            cart_name: body.cartName, start: body.start, end: body.end, user: body.emails, classroom: body.classrooms, checkboxes: {
                bad_return: body["checkbox.bad_return"],
                missing_laptop: body["checkbox.missing_laptop"],
                broken_laptop: body["checkbox.broken_laptop"],
                missing_lock: body["checkbox.missing_lock"],
                unused: !!body["checkbox.unused"] || body["checkbox.unused"] === '',
            }, notes: body.notes, disabled: body["info.disabled"],
        }
    }
    console.log("Reservation", reservation);
    await new SingleReservation(reservation).save();

    // force refresh on all clients
    refreshClients(date)
    return res.send()
}


export async function DisplayAdminPanel(req, res) {
    DisplayStaffPanel(req, res, true)
}

/**
 * Displays the staff / admin interface (maybe pass admin data as HTML instead of boolean to avoid having too much logic inside the templates)
 * Automatically places the date to the current week (or pass the day and have it handle the proper display later on?)
 */
async function DisplayStaffPanel(req, res, secretSauce = false) {
    // we start with the list of carts we want to display. there's a few ways to obtain it, say in the case the teacher interface. we look at the
    // current level, retrieve the carts on that level from the database, and retrieve the relevant data for the current day.
    let today = DateUtils.getDate();
    let weekStart = today.getDate() - today.getDay();
    let table_data = []
    for (let i = 0; i < 5; i++) {
        let new_date = new Date(today);
        new_date.setDate(weekStart + i);
        table_data.push(await getTableData(all_carts, new_date))
    }
    let new_date = new Date(today);
    new_date.setDate(weekStart);

    res.render("interfaceStaff", {admin: secretSauce, tableData: table_data, du: DateUtils, startDate: new_date, date_selector_count: 100, cart_levels: [1, 2, 3]})
}

async function DisplayLongPanel(req, res) {
    let long_data = await getLongData();
    res.render("interfaceStaffLongEditor", {longData: long_data, carts: all_carts});
}

export async function DisplayTeacherPanel(req, res) {
    let data = {carts: all_carts, displayForm: true};
    if (Object.keys(req.query).length > 0) {
        let date = DateUtils.convertFromISO(req.query?.date);
        let level = Number(req.query?.level);
        let carts_this_level = all_carts.filter((x) => x.floor === level);
        data = {
            ...data,
            displayForm: false,
            tableData: await getTableData(carts_this_level, date, true),
            // date_str: `Current selected date is ${DateUtils.getAsFullDateString(date)}, and you are looking at floor ${level}`
            date_str: ` התאריך הנבחר הוא ${DateUtils.getAsFullHebrewDateString(date)}, והקומה היא ${level}`
        }
    }
    res.render("InterfaceTeachers", data);
}

/**
 */
async function getLongData() {
    // obtain longs
    let date = DateUtils.getDate();
    return await LongReservation.find({date_to: {$gte: new Date(date.getFullYear(), date.getMonth() - 1, 0)}}).lean().exec()
}

/**
 * For the given list of carts, and a date
 * generates the table data.
 * @param carts list of carts
 * @param date date to check reservations for
 * @returns both the contents and the headers of the table to be displayed for the given list of carts
 */
async function getTableData(carts, date, full_separation = false) {
    // obtain table contents
    let table_contents = null;
    carts?.sort((a, b) => {
        // return a.group < b.group ? -1 : a.group > b.group;
        return a.floor - b.floor;
    })
    let table_headers = getTableHeaders(carts, true, full_separation);
    let reservation_data = await getReservationData([...cartTableHours.keys()], carts, date);
    return {contents: getTableContents(cartTableHours, table_contents, table_headers?.slice(1), reservation_data), headers: table_headers, date_formatted: DateUtils.getDateForInputField(date)};
}

function getDisplayName(email) {
    // try to find email in email database
    let val = EMAIL_PAIRS.find((v) => v.email === email);
    if (!!val) return val.name;
    return email.replace(/@.*/, "");
}

/**
 * Returns the reservation data in some useful format
 * @param hours hour information, really only need the number of hours
 * @param carts required for cart names
 * @param date date for which to retrieve the data
 */
export async function getReservationData(hours, carts, date) {
    // load up data
    let weekDay = date.getDay();
    let longs = await LongReservation.find({date_from: {$lte: date}, date_to: {$gte: date}, "info.cart_name": carts.map(x => x.name), day_of_week: weekDay}).exec();
    let singles = await SingleReservation.find({date: date, "info.cart_name": carts.map(x => x.name)}).exec();
    let reservations = []

    for (let hour of hours) {
        let curr_hour = {};
        for (let r of [...longs, ...singles]) {
            if (r.info.start <= hour && hour < r.info.end) curr_hour[r.info.cart_name] = {
                user: r.info.user,
                long: r.__type === "LongReservations",
                displayName: getDisplayName(r.info.user),
                overwrittenLong: (!!curr_hour[r.info.cart_name]?.long || !!curr_hour[r.info.cart_name]?.overwrittenLong),
            };
        }
        // post process adding charge tags to empty locations after and before taken locations but that are not breaks.
        if (hour > hours[0]) {
            let prev_hour = reservations.slice(-1)[0];
            carts.forEach((x) => {
                let cart = x.name;
                // either it exists or is unused i guess, AND the other one is not a charge to avoid stacking charges
                if (!!prev_hour?.[cart] && !prev_hour?.[cart]?.charge && (!curr_hour?.[cart] || curr_hour?.[cart]?.unused)) curr_hour[cart] = {charge: true};
                if (!prev_hour?.[cart] && !!curr_hour?.[cart]) prev_hour[cart] = {charge: true};
            })
        }
        reservations.push(curr_hour);
    }
    return reservations;
}

/**
 *
 * @param hours Array containing every time interval to be displayed. time intervals should be in the form of tuple(start, end),
 * anything else is considered a label to be inserted into the matrix
 * @param carts_contents an object with a property for each cart, containing an array with an entry for every interval in hours, indexed by the interval number.
 * not sure whether to allow for empty columns.. how do?
 * @param carts contains the list of carts that are to be displayed
 * @param reservation_data matrix containing the relevant reservation data i.g., either a matrix or an object idk yet
 * @returns an array of rows, each an object containing the row header, and row contents. this function inserts charge blocks where necessary, along with breaks and level indicators, and charge
 */
function getTableContents(hours, carts_contents, carts, reservation_data) {
    const dateFormat = new Intl.DateTimeFormat("en-GB", {hour: "numeric", minute: "numeric", hour12: false});
    const MS_PER_MINUTE = 60 * 1000;
    const SHORT_BREAK = 5; // minutes
    let contents = [];
    let counter = 1;
    for (let hour in hours) {
        let data = [];
        let head = "Break";
        if (hour > 0 && hours[hour][0] - hours[hour - 1][1] > SHORT_BREAK * MS_PER_MINUTE) {
            // break time!
            data = carts.map((x) => {
                return {
                    value: "", long: false, overwrittenLong: false, displayName: "", charge: false, break: true,
                    hour_display: x === undefined,
                }
            })
            contents.push({header: head, cart_data: data})
        }
        if (Array.isArray(hours[hour]) && hours[hour].length === 2) {
            // add cart contents at current_index to data
            head = `${dateFormat.format(hours[hour][0])}-${dateFormat.format(hours[hour][1])} - ${counter}`;
            data = carts.map((x) => {
                let reservationElem = reservation_data[hour][x];
                return {
                    value: reservationElem?.user ?? "", long: !!reservationElem?.long, overwrittenLong: !!reservationElem?.overwrittenLong, // && !reservationElem?.long,
                    displayName: x === undefined ? Number(hour) + 1 : reservationElem?.displayName ?? "", // TODO move the hour to separate property
                    charge: reservationElem?.charge,
                    hour_display: x === undefined,
                }
            });
            contents.push({header: head, cart_data: data})
            counter += 1;
        }
    }
    return contents;
}

/**
 * Creates headers for the table
 * @param carts list of cart objects
 * @param include_separators whether to include the floor / group based separation
 * @returns An array of headers for the table
 */
function getTableHeaders(carts, include_separators = false, separate_every_row = false, separate_by = "floor") {
    if (include_separators) {
        let headers = ["Hour"];
        let grp = carts[0][separate_by];
        carts.forEach(x => {
            if (x[separate_by] !== grp || (separate_every_row && x !== carts[0])) {
                headers.push(undefined);
                grp = x[separate_by];
            }
            headers.push(x.name);
        })
        return headers
    }
    return ["Hour", ...(carts.map(x => x.name))]
}

/**
 * Sends an email with the given contents
 */
async function sendEmail(source, contents) {
    let mailOptions = {
        from: "test@leyada.net", // from: source,
        to: 'test@leyada.net', subject: `Carts Website Request`, text: contents, auth: {
            user: source,
        }
    };
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(`Email sent by ${source}`);
        }
    });
}