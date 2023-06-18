import mongoose from "mongoose";

const Schema = mongoose.Schema;
export const UserTypes = ['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'UNDEFINED'];

const UserSchema = new Schema({
    google: {
        id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        picture: {
            type: String,
        },
    },
    type: {
        type: String,
        enum: UserTypes,
        default: 'UNDEFINED'
    },
});

const User = mongoose.model("User", UserSchema);

export {
    User as default
};