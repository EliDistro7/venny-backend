# NyumbaTZ API

Express + MongoDB backend for the NyumbaTZ property listings site. Images are
stored in Cloudflare R2. A single static admin account is seeded into MongoDB
on first server start, used to log into the admin dashboard.

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Set up MongoDB

Use a local MongoDB instance or a free MongoDB Atlas cluster. Copy the
connection string into `MONGO_URI` in your `.env` file.

## 3. Set up Cloudflare R2

1. In the Cloudflare dashboard, go to **R2 Object Storage** and create a bucket
   (e.g. `nyumbatz-properties`).
2. Under **Settings** for that bucket, enable public access, either via the
   free `r2.dev` subdomain or by connecting a custom domain. Copy that URL —
   this is your `R2_PUBLIC_URL`.
3. Go to **R2 > Manage R2 API Tokens** and create a token with read/write
   permissions scoped to the bucket. This gives you `R2_ACCESS_KEY_ID` and
   `R2_SECRET_ACCESS_KEY`.
4. Your `CLOUDFLARE_ACCOUNT_ID` is shown in the right sidebar of the
   Cloudflare dashboard overview page.

## 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your Mongo URI, a random `JWT_SECRET`, the R2 credentials
above, and the admin email/password you want seeded on first run:

```
ADMIN_EMAIL=admin@nyumbatz.co.tz
ADMIN_PASSWORD=ChangeMe123!
```

These are only used once — on the very first server start, if no admin
exists in the database yet, one is created from these values. Changing them
later in `.env` won't reset an existing admin.

## 5. Run the server

```bash
npm run dev      # with nodemon, auto-restarts on changes
# or
npm start
```

On first run you'll see a log line confirming the admin was seeded. The API
is then available at `http://localhost:5000`.

## API reference

| Method | Route                  | Auth | Description                          |
|--------|------------------------|------|---------------------------------------|
| POST   | `/api/auth/login`      | No   | `{ email, password }` → `{ token }`   |
| GET    | `/api/auth/me`         | Yes  | Current admin info                    |
| GET    | `/api/properties`      | No   | List properties (filterable)          |
| GET    | `/api/properties/:id`  | No   | Single property                       |
| POST   | `/api/properties`      | Yes  | Create (multipart, field `images`)    |
| PUT    | `/api/properties/:id`  | Yes  | Update (multipart, `images`, `removeImages`) |
| DELETE | `/api/properties/:id`  | Yes  | Delete property + its R2 images       |

Protected routes require `Authorization: Bearer <token>`.

Query filters on `GET /api/properties`: `city`, `type` (`sale`/`rent`),
`category` (`apartment`/`villa`/`house`/`land`/`commercial`), `featured`
(`true`/`false`).
