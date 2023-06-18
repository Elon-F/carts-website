import mongoose from "mongoose";

const Schema = mongoose.Schema;

const MailSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    ou: {
        type: String,

    }
});

const EmailMap = mongoose.model("EmailMap", MailSchema);

export {
    EmailMap as default
};