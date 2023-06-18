import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ConfigSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    data: {
        type: Schema.Types.Mixed
    }
}, { collection: 'configuration' });

const Config = mongoose.model("Config", ConfigSchema, );

export {
    Config as default
};