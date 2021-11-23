const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var ConfigurationSchema = new Schema({
    email_server_name: {
        type: String
    },
    email_host: {
        type: String
    },
    email_port: {
        type: Integer
    },
    email_secure: {
        type: Boolean
    },
    email_user: {
        type: String
    },
    email_pass: {
        type: String
    },
    email_name: {
        type: String
    },
    notification_email: {
        type: String
    },
    issue_notification_enabled: {
        type: Boolean
    },
    delivered_notification_enabled: {
        type: Boolean
    },
    update_check_interval_hours: {
        type: Integer
    },
    notification_no_update_interval_hours: {
        type: Integer
    }

});


module.exports = mongoose.model('Configuration', ConfigurationSchema);