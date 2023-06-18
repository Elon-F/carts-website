import mongoose from "mongoose";

const Schema = mongoose.Schema;

const CartSchema = new Schema({
    name: {
        type: String, required: true, unique: true
    },
    group: {
        type: String, required: true
    },
    floor: {
        type: Number, required: true
    },
    computers: [{
        computerCount: {
            type: Number
        },
        computerType: {
            type: String
        },
    }]
});

const Cart = mongoose.model("Cart", CartSchema);

export {
    Cart as default
};