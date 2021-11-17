const mongoose = require('mongoose');
const beautifyUnique = require('mongoose-beautiful-unique-validation');

var Schema = mongoose.Schema;

var PackageQueueSchema = new Schema({
    courier: {
        type: String,
        required: true
    },
    tracking_id: {
        type: String,
        required: true
    }
});

PackageQueueSchema.plugin(beautifyUnique);

PackageQueueSchema.index({ courier: 1, tracking_id: 1 }, { unique: true })

module.exports = mongoose.model('PackageQueue', PackageQueueSchema);