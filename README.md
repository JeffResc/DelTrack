# DelTrack

DelTrack is an all-in-one delivery tracking solution supporting 24 couriers (USPS, UPS, FedEx, DHL, etc.) and counting! Notifications can be setup for an email when a package has an exception or has not had a new tracking event in 24 hours.

## Features
- Track unlimited packages from a centralized location
- Store package information in MongoDB for easy reference at a later date
- Local user authentication and registration (registration can be disabled after setting up initial account(s))
- Live scanner using camera or uploaded files to easily add deliveries from the tracking label barcode

## Screenshots
Home
![Home Screenshot](https://github.com/JeffResc/DelTrack/blob/main/.demo-images/home.png?raw=true)

Delivery Details
![Delivery Details Screenshot](https://github.com/JeffResc/DelTrack/blob/main/.demo-images/delivery-details.png?raw=true)

Live Scanner
![Live Scanner Screenshot](https://github.com/JeffResc/DelTrack/blob/main/.demo-images/live-scanner.png?raw=true)

Login Page
![Login Screenshot](https://github.com/JeffResc/DelTrack/blob/main/.demo-images/login.png?raw=true)

## Setup

### .env File
Create a .env file at the root directory where `docker-compose.yml` is and set the following environment variables:
| Variable                   | Description                                                                                                                   |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| MONGO_STRING               | Your MongoDB URI String. Should be something similar to: "mongodb://deltrack:deltrack@mongo:27017/deltrack?authSource=admin". |
| SESSION_SECRET             | A random session secret string.                                                                                               |
| EMAIL_SERVER_NAME          | The SMTP server's name. Usually it's FQDN.                                                                                    |
| EMAIL_HOST                 | The host IP/domain of the SMTP server.                                                                                        |
| EMAIL_USER                 | The username of the email user. Usually the user's email address/                                                             |
| EMAIL_PASS                 | The password of the email user.                                                                                               |
| EMAIL_NAME                 | The full name of the email user.                                                                                              |
| NOTIFY_EMAIL               | The email to send notifications to.                                                                                           |
| MONGO_INITDB_ROOT_USERNAME | The initialized MongoDB root username. If using the MONGO_STRING from above, set this to "deltrack".                          |
| MONGO_INITDB_ROOT_PASSWORD | The initialized MongoDB root password. If using the MONGO_STRING from above, set this to "deltrack".                          |

### Other variables
Set the `REGISTRATION=1` environment variable in the DelTrack container to enable user registration. Set the `REGISTRATION=0` environment variable in the DelTrack container to disable user registration.

### Start docker-compose
Run the following command in the root directory to start DelTrack:
```bash
docker-compose up -d
```
