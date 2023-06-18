import mongoose from "mongoose";
import {getDate} from "../dateUtils.js"

const Schema = mongoose.Schema;

const reservationInfo = new Schema({
    cart_name: {
        type: String,
        required: true,
    },
    start: { // by index, start at 0.
        type: Number,
        required: true,
    },
    end: { // by index, start at 0.
        type: Number,
        required: function () {
            return this.start < this.end
        },
    },
    user: {
        type: String,
        required: true,
    },
    classroom: {
        type: String,
        required: true,
    },
    checkboxes: {
        bad_return: String,
        missing_laptop: String,
        broken_laptop: String,
        missing_lock: String,
        unused: Boolean,
    },
    notes: String,

    disabled: {
        type: Boolean,
        default: false,
        required: true
    },
})

// TODO store dates as strings instead?
const singleReservationSchema = new Schema({
    date: {
        type: Date,
        required: true,
        set: getDate,
    },
    info: {
        type: reservationInfo,
        required: true
    },
});

const longReservationSchema = new Schema({
    date_from: {
        type: Date,
        required: true,
        set: getDate,
    },
    date_to: {
        type: Date,
        required: true,
        set: getDate,
    },
    day_of_week: {
        type: Number,
        required: true,
        min: 0,
        max: 7
    },
    info: {
        type: reservationInfo,
        required: true
    },
});

function filter_disabled() {
    if (!this.getQuery()?.["info.disabled"]) {
        this.where({"info.disabled": {$ne: true}});
    }
}

singleReservationSchema.pre(['find', 'findOne', 'findById'], filter_disabled);

longReservationSchema.pre(['find', 'findOne', 'findById'], filter_disabled);

//Then define discriminator field for schemas:
const reservationOptions = {
    discriminatorKey: '__type',
    collection: 'reservations'
};

const ReservationBase = mongoose.model("ReservationBase", new Schema({}, reservationOptions));

const SingleReservation = ReservationBase.discriminator("SingleReservation", singleReservationSchema,);
const LongReservation = ReservationBase.discriminator("LongReservations", longReservationSchema,);

export {
    SingleReservation, LongReservation
};