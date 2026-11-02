# Render and Neon deployment

This runbook publishes the portfolio demo with a free Render web service and a
free Neon PostgreSQL database. Render terminates HTTPS and runs the repository's
Docker image. Neon stores application data and ASP.NET Core data-protection keys,
so administrator sessions remain valid when the free Render instance restarts.

The hosted demo intentionally disables new image uploads because a free Render
service has an ephemeral file system. The four bundled Pixel Hunt images and all
other committed assets remain available.

## 1. Create the Neon database

1. Sign in to Neon and create a project for the escape room.
2. Choose a European region close to Render's Frankfurt region when available.
3. Keep the default production branch and database.
4. Open **Connect**, select the pooled connection, and copy its connection URL.
5. Confirm that the URL ends with `sslmode=require`. The application also enforces
   TLS when it converts this URL to the Npgsql connection format.

Treat the connection URL as a password. Do not paste it into source files,
screenshots, issues, chat messages, or GitHub Actions logs.

## 2. Create the Render service

1. Sign in to Render with the GitHub account that can access the repository.
2. Choose **New > Blueprint** and select this repository.
3. Use `render.yaml` from the repository root and deploy the `main` branch.
4. When Render prompts for secret environment variables, enter:
   - `ConnectionStrings__Database`: the pooled Neon connection URL,
   - `Admin__Username`: a private administrator username,
   - `Admin__Password`: a unique password containing at least 16 characters.
5. Review the Blueprint and create the free web service.

Do not add a Render PostgreSQL database. The Blueprint defines only the web
service because Neon provides the durable database.

The Blueprint configures:

- the free Frankfurt web service and Docker build,
- Render's managed HTTPS/load-balancer headers,
- explicit production host filtering,
- secure authentication and antiforgery cookies,
- HSTS and the application's security headers,
- database-backed data-protection keys,
- demo-only results and 30-day automatic retention,
- disabled image uploads on ephemeral storage,
- `/health/ready` as the deployment health check,
- automatic deployment only after GitHub checks pass.

## 3. Verify the live deployment

Render provides an address ending in `.onrender.com`. The first request after 15
minutes of inactivity can take about a minute while a free service wakes up.

Verify each item before adding the URL to the README:

1. Opening the Render URL uses HTTPS and does not produce a certificate warning.
2. `/health/live` returns a healthy response.
3. `/health/ready` returns a healthy response and therefore confirms database
   connectivity.
4. A player can start a session, complete a game, and see the result in the demo
   leaderboard.
5. Administrator login works at `/admin`.
6. An administration change remains after refreshing the page.
7. Restart the Render service and confirm that administrator login and existing
   results still work. This verifies database-backed data-protection keys.
8. The administration explains that image replacement is unavailable in the
   hosted demo, while the bundled Pixel Hunt images still load in the game.

Never use production credentials in automated screenshots or test recordings.

## 4. Update and release

Render watches `main`. A push to another branch does not change the live site.
After a pull request is merged into `main`, Render waits for the linked GitHub
checks to pass and then deploys the new commit automatically.

After the live verification succeeds:

1. add the public URL to the README,
2. rerun the launch smoke checks,
3. review the prepared release notes,
4. create tag and GitHub release `v1.0.0` only after explicit approval.

## Operational limitations

This is a hobby/portfolio deployment, not an event production environment.
Render Free sleeps when idle and its local file system is not durable. The
physical event configuration remains the local Docker stack with image uploads,
event-only results, and the documented volume backup/restore procedure.

Keep an independent database export before important changes. The repository's
Docker volume backup scripts apply to the local/VPS stack; they do not run against
Neon automatically.
