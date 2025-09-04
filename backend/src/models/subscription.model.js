import mongoose,{Schema} from "mongoose";

const subscriptionSchema = new Schema ({
    subscriber : {
        // the one who is subscribing
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel :{
        // the subscriber is subscribing to this channel
        type: Schema.Types.ObjectId,
        ref: "User"

    }
})

export const Subscription = mongoose.model("Subscripton",subscriptionSchema)