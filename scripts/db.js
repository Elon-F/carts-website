import mongoose from "mongoose";

const dbUrl = "mongodb://127.0.0.1:27017/CartsWebsite";

export const connect = async () => {
    try {
        await mongoose.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
        console.log("> Successfully connected to the database.");
    } catch (error) {
        console.error("> An error occurred upon connecting to the database:", error);
        throw error;
    }
};
