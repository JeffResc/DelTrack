const express = require('express');
const passport = require('passport');
const session = require('express-session');
const process = require('process');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const tracker = require('delivery-tracker');
const MongoStore = require('connect-mongo');
const moment = require('moment');

const functions = require('./functions');
const User = require('./models/user');
const Package = require('./models/package');
const PackageQueue = require('./models/package_queue');
const Configuration = require('./models/configuration');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_STRING
    })
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(express.static('static'));

app.get('/', functions.ensureLogin, (req, res) => {
    Package.find({ status: { $ne: "Delivered" } }, null, { sort: { last_update: -1 } }, function(err, docs) {
        if (err) throw err;
        functions.getConfig((config) => {
            res.render('home', {
                packages: docs,
                tracker: tracker,
                configuration: config,
                trackingURLHTML: functions.trackingURLHTML,
                moment: moment
            });
        });
    });
});

app.get('/delivered', functions.ensureLogin, (req, res) => {
    Package.find({ status: "Delivered" }, null, { sort: { last_update: -1 } }, function(err, docs) {
        if (err) throw err;
        functions.getConfig((config) => {
            res.render('delivered', {
                packages: docs,
                tracker: tracker,
                configuration: config,
                trackingURLHTML: functions.trackingURLHTML,
                moment: moment
            });
        });
    });
});

app.get('/scanner', functions.ensureLogin, (req, res) => {
    res.render('scanner', {
        tracker: tracker
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});
app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login#fail"
}), function(req, res) {});

app.get('/register', (req, res) => {
    res.render('register', {
        registration: parseInt(process.env.REGISTRATION)
    });
});
app.post('/register', (req, res) => {
    if (parseInt(process.env.REGISTRATION) == 1) {
        User.register(new User({ username: req.body.username }), req.body.password, (err, user) => {
            if (err) {
                console.error(err);
                res.redirect('/register');
            } else {
                passport.authenticate('local')(req, res, () => {
                    res.redirect('/');
                });
            }
        });
    } else {
        res.redirect('/register');
    }
});
app.get('/logout', (req, res, next) => {
    if (req.session) {
        req.logout();
        req.session.destroy((err) => {
            if (err) {
                console.error(err);
            } else {
                res.clearCookie('session-id');
                res.redirect('/login');
            }
        });
    } else {
        var err = new Error('You are not logged in!');
        err.status = 403;
        next(err);
    }
});

app.post('/delete_shipment', functions.ensureLogin, (req, res) => {
    Package.findOneAndDelete({ courier: req.body.courier, tracking_id: req.body.tracking_id }, function(err, doc) {
        if (err) console.error(err);
        PackageQueue.findOneAndDelete({ courier: req.body.courier, tracking_id: req.body.tracking_id }, function(err, doc) {
            if (err) console.error(err);
            res.send(JSON.stringify({ msg: 'Successfully deleted ' + req.body.courier + ' ' + req.body.tracking_id }));
        });
    });
});

app.post('/add_shipment', functions.ensureLogin, (req, res) => {
    functions.addAndTrack(req.body.courier, req.body.tracking_id, function(msg) {
        res.send(JSON.stringify({ msg: msg }));
    });
});

app.post('/add_bulk_shipment', functions.ensureLogin, (req, res) => {
    req.body.tracking_ids.split(/\r?\n/).forEach(tracking_id => {
        functions.addPackageToQueue(req.body.courier, tracking_id);
    });
    res.redirect('/');
});

app.post('/track_and_update', functions.ensureLogin, (req, res) => {
    functions.trackAndUpdate(req.body.courier, req.body.tracking_id);
    res.send(JSON.stringify({ msg: 'Successfully updated ' + req.body.courier + ' ' + req.body.tracking_id }));
});

app.post('/submit_settings', functions.ensureLogin, (req, res) => {
    Configuration.findOneAndUpdate({}, {
        $set: req.body
    }, {
        upsert: true
    }, function(err, doc) {
        if (err) console.error(err);
        console.log(doc);
        res.send(JSON.stringify({ msg: 'Successfully updated settings. Restarting server for changes to take effect, please wait a moment...' }));
        setTimeout(() => {
            process.exit();
        }, 3000);
    });
});

function start_server() {
    functions.createTransporter();

    app.listen(3000, () => {
        console.log(`DelTrack is listening at http://localhost:3000`);
    });

    setInterval(function() {
        PackageQueue.findOneAndDelete({}, function(err, doc) {
            if (err) console.error(err);
            if (doc !== null) {
                console.log('Found package in queue: ' + doc.courier + " " + doc.tracking_id);
                Package.countDocuments({ tracking_id: doc.tracking_id, courier: doc.courier }, (err, count) => {
                    if (err) console.error(err);
                    if (count == 0) {
                        functions.addAndTrack(doc.courier, doc.tracking_id, function() {
                            console.log('Added and tracked new package: ' + doc.courier + ' ' + doc.tracking_id);
                        });
                    } else {
                        functions.trackAndUpdate(doc.courier, doc.tracking_id);
                    }
                });

            }
        });
    }, 10 * 1000); // 10 seconds
    setInterval(function() {
        functions.checkForUpdates();
    }, 30 * 1000); // 30 seconds
}

functions.connectDB(function() {
    Configuration.countDocuments({}, (err, count) => {
        if (err) throw err;
        if (count == 0) {
            console.log("No configuration found, creating default");
            // Initialize the configuration
            var config = new Configuration({
                email_server_name: process.env.EMAIL_SERVER_NAME || '',
                email_host: process.env.EMAIL_HOST || '',
                email_port: 465,
                email_secure: true,
                email_user: process.env.EMAIL_USER || '',
                email_pass: process.env.EMAIL_PASS || '',
                email_name: process.env.EMAIL_NAME || '',
                notification_email: process.env.NOTIFY_EMAIL || '',
                issue_notification_enabled: false,
                delivered_notification_enabled: false,
                update_check_interval_hours: 6,
                notification_no_update_interval_hours: 48
            });
            config.save()
        } else {
            console.log("Configuration found, loading from database");
        }
        start_server();
    });
});