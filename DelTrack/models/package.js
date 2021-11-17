const mongoose = require('mongoose');
const beautifyUnique = require('mongoose-beautiful-unique-validation');

var Schema = mongoose.Schema;

var PackageSchema = new Schema({
    courier: {
        type: String,
        required: true
    },
    tracking_id: {
        type: String,
        required: true
    },
    destination: {
        type: String
    },
    status: {
        type: String,
        required: true
    },
    last_check: {
        type: Date,
        required: true
    },
    last_update: {
        type: Date,
        required: true
    },
    created_at: {
        type: Date,
        required: true
    },
    last_notification: {
        type: Date
    },
    checkpoints: [{
        location: {
            type: String
        },
        message: {
            type: String
        },
        status: {
            type: String
        },
        time: {
            type: Date
        }
    }]
});

PackageSchema.plugin(beautifyUnique);

PackageSchema.index({ courier: 1, tracking_id: 1 }, { unique: true })

module.exports = mongoose.model('Package', PackageSchema);