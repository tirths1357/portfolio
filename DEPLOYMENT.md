# Deployment Guide

This portfolio has two workable deployment modes:

- Local development on your laptop
- Vercel for the public portfolio and contact form
- Full Node deployment on Railway

This repo now includes Vercel serverless functions for the public site contact flow.

## Local Development

1. Open the project folder.
2. Create a `.env` file from `.env.example`.
3. Start the app:

```powershell
npm.cmd install
npm.cmd start
```

4. Open:

- `http://localhost:3000/`
- `http://localhost:3000/login.html`
- `http://localhost:3000/admin.html`

## Required `.env` Values

Use these for local development:

```env
PORT=3000
ADMIN_EMAIL=tirths1308@gmail.com
ADMIN_PASSWORD=myadmin123
EMAIL_SERVICE=gmail
GMAIL_USER=tirths1308@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
OWNER_EMAIL=tirths1308@gmail.com
CONTACT_NOTIFICATION_EMAIL=tirths1308@gmail.com
EMAIL_TLS_REJECT_UNAUTHORIZED=false
```

Important:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` protect the admin login.
- `GMAIL_APP_PASSWORD` must be a Google App Password, not your normal Gmail password.
- Keep `.env` out of GitHub.

## Railway Deployment

Railway is the best fit for this project because it runs `server.js`.

### 1. Connect the repo

- Create a new Railway project.
- Deploy from GitHub.
- Use `npm start` as the start command if Railway does not detect it automatically.

### 2. Add variables

Set these Railway environment variables:

```env
ADMIN_EMAIL=tirths1308@gmail.com
ADMIN_PASSWORD=myadmin123
EMAIL_SERVICE=gmail
GMAIL_USER=tirths1308@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
OWNER_EMAIL=tirths1308@gmail.com
CONTACT_NOTIFICATION_EMAIL=tirths1308@gmail.com
EMAIL_TLS_REJECT_UNAUTHORIZED=false
```

### 3. Add persistence

The app stores:

- messages in `data/portfolio.sqlite`
- resume uploads in `assets/`

If you want data to survive redeploys and restarts, add a persistent volume for:

- `data/`
- `assets/`

### 4. Open the live link

- Use the public Railway domain shown in the service settings.
- Open `/` for the site.
- Open `/login.html` for the admin login page.

## Vercel Deployment

Vercel is now supported for:

- the public portfolio
- the contact form email endpoint
- static resume download

Vercel is not used for:

- admin content editing
- inbox message storage
- resume uploads from the admin panel
- SQLite persistence

### Vercel environment variables

Set these in Vercel:

```env
EMAIL_SERVICE=gmail
GMAIL_USER=tirths1308@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
OWNER_EMAIL=tirths1308@gmail.com
CONTACT_NOTIFICATION_EMAIL=tirths1308@gmail.com
EMAIL_TLS_REJECT_UNAUTHORIZED=false
```

### Vercel behavior

- `index.html` works
- `/api/contact` sends email from a serverless function
- `/api/content` reads `data/site-content.json`
- the admin button is hidden on `*.vercel.app`
- `login.html` and `admin.html` show a clear message that admin editing needs Railway

## Admin Access

The admin login is restricted to the Gmail address in `ADMIN_EMAIL`.

For this project:

- Email: `tirths1308@gmail.com`
- Password: `myadmin123`

Change those values in your environment variables if you want a different admin.
