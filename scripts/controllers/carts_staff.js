import express from "express";
import {fileURLToPath} from "url";
import {dirname} from "path";
import {UpdateLongReservations, RenderEntryEditor, RenderCartsMatrix, updateReservations, updateLongReservations, DisplayAdminPanel} from "./carts.js";
import autocomplete from "./auto_complete.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default router;

router.get("/", SendInterface)

router.get("/reservations", UpdateLongReservations);

router.post("/render_editor", RenderEntryEditor);

router.post("/render_carts_matrix", RenderCartsMatrix);

router.post("/update_reservations", updateReservations);

router.post("/update_reservation_long", updateLongReservations);

router.use(autocomplete);

async function SendInterface(req, res) {
    DisplayAdminPanel(req, res) // maybe add the switch for admin / staff in here?
}
