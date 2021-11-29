const mongoose = require('mongoose');
const tracker = require('delivery-tracker');
const nodemailer = require("nodemailer");

const Package = require('./models/package');
const PackageQueue = require('./models/package_queue');
const Configuration = require('./models/configuration');

var transporter = "";

function createTransporter() {
    getConfig((config) => {
        transporter = nodemailer.createTransport({
            host: config.email_host,
            port: 465,
            secure: config.email_secure,
            auth: {
                user: config.email_user,
                pass: config.email_pass,
            },
            tls: {
                servername: config.email_server_name
            }
        });
    });
}


async function connectDB(cb) {
    return await mongoose.connect(process.env.MONGO_STRING, {
        useNewUrlParser: true
    }).then(() => {
        console.log('Connected to MongoDB');
        cb();
    }).catch((err) => {
        console.error(err);
    });
}

function ensureLogin(req, res, next) {
    return req.isAuthenticated() ? next() : res.redirect('/login');
}

function notifyUser(subject, message, pkg, type) {
    getConfig((config) => {
        if ((config.issue_notification_enabled && type == "issue") || (delivered_notification_enabled && type == "delivered")) {
            if (typeof pkg.last_notification == 'undefined' || new Date(pkg.last_notification).getTime() < new Date(new Date() - (24 * 60 * 60 * 1000)).getTime()) {
                transporter.sendMail({
                    from: '"' + config.email_name + '" <' + config.email_user + '>', // sender address
                    to: config.notification_email, // list of receivers
                    subject: subject, // Subject line
                    text: message + '\n\nLastMessage: ' + pkg.checkpoints[0].message + '\nLast Location: ' + pkg.checkpoints[0].location + '\nLast time: ' + pkg.checkpoints[0].time // plain text body
                });
                console.log("Notification has been sent to " + config.notification_email + " in regards to " + pkg.courier + " " + pkg.tracking_id);
                Package.findOneAndUpdate({ tracking_id: pkg.tracking_id, courier: pkg.courier }, { last_notification: Date.now() }, (err, doc) => {
                    if (err) console.error(err);
                });
            } else {
                console.log("Notification has already been sent to " + config.notification_email + " within the past 24 hours");
            }
        }
    });
}

function checkAndNotifyPackages(pkg) {
    getConfig((config) => {
        if (pkg.status == "Delivered") {
            notifyUser("DelTrack Package Alert", "Package " + pkg.tracking_id + " has been delivered to " + pkg.destination, pkg, "delivered");
        } else if (pkg.status === "Returned" || pkg.status === "Exception" || pkg.status === "FailAttempt") {
            notifyUser("DelTrack Package Alert", "Package " + pkg.courier + " " + pkg.tracking_id + " has been new status alert: " + pkg.status, pkg, "issue");
        } else if (pkg.status === "InfoRecieved" && new Date(pkg.last_update).getTime() < new Date(new Date() - (config.notification_no_update_interval_hours * 60 * 60 * 1000)).getTime()) {
            notifyUser("DelTrack Package Alert", "Package " + pkg.courier + " " + pkg.tracking_id + " has not been checked into the postal system in at least 48 hours.", pkg, "issue");
        } else if (pkg.status === "InTransit" && new Date(pkg.last_update).getTime() < new Date(new Date() - (config.notification_no_update_interval_hours * 60 * 60 * 1000)).getTime()) {
            notifyUser("DelTrack Package Alert", "Package " + pkg.courier + " " + pkg.tracking_id + " has not a tracking event in at least 48 hours.", pkg, "issue");
        } else if (pkg.status == "Label Created, not yet in system" && new Date(pkg.created_at).getTime() < new Date(new Date() - (config.notification_no_update_interval_hours * 60 * 60 * 1000)).getTime()) {
            notifyUser("DelTrack Package Alert", "Package " + pkg.courier + " " + pkg.tracking_id + " label has not been valid for at least 48 hours.", pkg, "issue");
        }
    });
}

function addAndTrack(courier_code, tracking_id, cb) {
    console.log("Adding " + courier_code + " " + tracking_id);
    Package.countDocuments({ tracking_id: tracking_id, courier: courier_code }, (err, count) => {
        if (err) console.error(err);
        if (count == 0) {
            tracker.courier(courier_code).trace(tracking_id, (err, data) => {
                if (err) {
                    if (err.code == 10) {
                        var new_package = new Package({ tracking_id: tracking_id, courier: courier_code, status: "Label Created, not yet in system", last_check: Date.now(), created_at: Date.now(), last_update: Date.now() });
                        new_package.save()
                            .then(() => cb(courier_code + " " + tracking_id + " added successfully (Label Created, not yet in system)"))
                            .catch((err) => {
                                console.error(err);
                                cb("Error adding package to database, see logs");
                            });
                    } else {
                        console.error(err);
                    }
                } else {
                    const dest = (data.status == "Delivered") ? (data.checkpoints[0].location) : (data.destination || "Unknown");
                    const edd = (data.status == "Delivered") ? ("N/A, Delivered") : (data.estimated_delivery_date);
                    var new_package = new Package({ tracking_id: tracking_id, courier: courier_code, edd: edd, status: data.status, destination: dest, last_check: Date.now(), created_at: Date.now(), checkpoints: data.checkpoints, last_update: data.checkpoints[0].time });
                    new_package.save()
                        .then(() => cb(courier_code + " " + tracking_id + " added successfully"))
                        .catch((err) => {
                            console.error(err);
                            cb("Error adding package to database, see logs");
                        });
                }
            });
        } else {
            console.log("Package already in system");
            cb(courier_code + " " + tracking_id + " already in system");
        }
    });
}

function trackAndUpdate(courier_code, tracking_id) {
    tracker.courier(courier_code).trace(tracking_id, (err, data) => {
        if (err) {
            if (err.code == 10) {
                Package.findOneAndUpdate({ tracking_id: tracking_id, courier: courier_code }, { status: "Label Created, not yet in system", last_check: Date.now(), last_update: Date.now() }, { new: true }, (err, doc) => {
                    if (err) {
                        console.error(err);
                    } else {
                        checkAndNotifyPackages(doc);
                    }
                });
            } else {
                console.error(err);
            }
        } else {
            //console.log(data);
            const dest = (data.status == "Delivered") ? (data.checkpoints[0].location) : (data.destination || "Unknown");
            const edd = (data.status == "Delivered") ? ("N/A, Delivered") : (data.estimated_delivery_date);
            Package.findOneAndUpdate({ tracking_id: tracking_id, courier: courier_code }, { edd: edd, status: data.status, destination: dest, checkpoints: data.checkpoints, last_check: Date.now(), last_update: data.checkpoints[0].time }, { new: true }, (err, doc) => {
                if (err) {
                    console.error(err);
                } else {
                    checkAndNotifyPackages(doc);
                }
            });
        }
    });
}

function addPackageToQueue(courier_code, tracking_id) {
    console.log("Recieved request to add " + courier_code + " " + tracking_id + " to queue");
    PackageQueue.countDocuments({ tracking_id: tracking_id, courier: courier_code }, (err, count) => {
        if (err) console.error(err);
        console.log("Count: " + count);
        if (count == 0) {
            var new_package = PackageQueue({ courier: courier_code, tracking_id: tracking_id });
            new_package.save()
                .catch((err) => {
                    console.error(err);
                });
            console.log("Granted request to add " + courier_code + " " + tracking_id + " to queue");
        } else {
            console.log("Denied request to add " + courier_code + " " + tracking_id + " to queue");
        }
    });
}

function checkForUpdates() {
    PackageQueue.countDocuments({}, (err, count) => {
        if (err) console.error(err);
        if (count == 0) {
            getConfig((config) => {
                Package.find({ status: { $ne: "Delivered" }, last_check: { $lt: new Date(Date.now() - 1000 * 60 * 60 * config.update_check_interval_hours) } }, (err, packages) => {
                    if (err) console.error(err);
                    packages.forEach(package => {
                        addPackageToQueue(package.courier, package.tracking_id);
                    });
                });
            });
        } else {
            console.log("Package queue is not empty, unable to add updates to queue");
        }
    });
}

function getConfig(cb) {
    Configuration.find({}, (err, config) => {
        if (err) throw err;
        cb(config[0]);
    });
}

module.exports = {
    connectDB,
    ensureLogin,
    notifyUser,
    checkAndNotifyPackages,
    addAndTrack,
    addPackageToQueue,
    trackAndUpdate,
    checkForUpdates,
    createTransporter,
    getConfig
};