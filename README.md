# Just a Corporate Goose

Just a Corporate Goose is a local-first Windows desktop planner with daily
planning, focus timers, reminders, task tracking, hydration goals, and
gamification.

## Privacy

Application state and private configuration stay on the local machine. They are
not stored in this repository.

- Daily state is stored in Electron's `dailygoose` user-data directory.
- Local connector settings belong in `local-config.json` in that same user-data
  directory.
- Authentication remains with the locally installed applications and command
  line tools. The app does not store access tokens or passwords.
- Generated builds, dependencies, profiles, environment files, certificates,
  credentials, and local configuration are excluded by `.gitignore`.

`local-config.example.json` documents the optional local settings without
containing real account or organization information.

## Development

```powershell
npm install
npm run dev
```

## Validation

```powershell
npm run build
npm run lint
```

## Package for Windows

```powershell
npm run dist
```

Generated installers and unpacked applications are written to `release\` and
must not be committed.
