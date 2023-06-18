import express from "express";
import {fileURLToPath} from "url";
import {dirname} from "path";
import {RenderCartsMatrix, updateReservations, DisplayTeacherPanel, getReservationData} from "./carts.js";
import * as DateUtils from "../dateUtils.js";
import {SingleReservation} from "../data_models/reservationModels.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default router;

router.get("/", DisplayTeacherPanel)

router.post("/send_email", async (req, res) => {
    await sendEmail(req?.session?.passport?.user?.google?.email, req.body.contents)
    return res.send();
});

router.post("/render_editor", RenderTeacherEntryEditor);

router.post("/render_carts_matrix", RenderCartsMatrix);

router.post("/update_reservations", updateReservations);

async function RenderTeacherEntryEditor(req, res) { // todo lol this is garbage
    let json_data = req.body;
    let date = DateUtils.convertFromISO(json_data.date);
    console.log("Incoming request for teacher entry editor: ", json_data, date);

    let hours = Array.from(new Array(json_data.end - json_data.start), (x, i) => i + json_data.start);
    let weekday = date.getDay();
    let reservation_data = await getReservationData(hours, [{name: json_data.cartName}], date) // TODO modify format so that this is useful here
    let emails = [...new Set(reservation_data.map(x => x[json_data.cartName]?.user).filter(x => x !== undefined))]
    let singles = await SingleReservation.find({
        date: date, "info.cart_name": json_data.cartName, "info.start": {$lt: json_data.end}, "info.end": {$gt: json_data.start},
    }).exec();

    let dangers = [];
    let alerts = []
    let infos = [];

    let classrooms = [...new Set(singles.map(x => x.info?.classroom).filter(x => x !== undefined))];

    res.render('partials/entry_editor_teach', {
        edit: singles.length, emails: emails, classrooms: classrooms, alerts: alerts, dangers: dangers, infos: infos, hours: ` ${hours[0]}` + (hours.length > 1 ? ` to ${hours.slice(-1)}` : "")
    });
}