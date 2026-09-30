<p align="center">
  <img src="src/assets/corporate-goose.png" alt="Just a Corporate Goose wearing sunglasses and a red tie" width="230" />
</p>

<h1 align="center">Just a Corporate Goose</h1>

Just a Corporate Goose is a local-first Windows desktop planner with daily
planning, focus timers, reminders, task tracking, hydration goals, and
gamification.

## Interface examples

The screenshots below use generic sample tasks. Personal task names, meeting
titles, account details, and local configuration have been removed.

### Main dashboard

<p align="center">
  <img src="docs/images/ui-main-dashboard.png" alt="Just a Corporate Goose main dashboard with a generic focus task, lunch reminder, and hydration tracker" width="100%" />
</p>

### Always-on-top focus timer

<p align="center">
  <img src="docs/images/ui-mini-timer.png" alt="Just a Corporate Goose compact focus timer with a generic project task" width="520" />
</p>

## Privacy

Application state and private configuration stay on the local machine. They are
not stored in this repository.

- Daily state is stored in Electron's `dailygoose` user-data directory.
- On the first launch, the app asks for a preferred name and the Azure DevOps
  organization, project, repository, and account email used by the PR-review
  connector.
- After setup is submitted, the app automatically creates
  `%APPDATA%\dailygoose\local-config.json`.
- The setup screen does not appear again while that file contains
  `"setupComplete": true`.
- Authentication remains with the locally installed applications and command
  line tools. The app does not store access tokens or passwords.
- Generated builds, dependencies, profiles, environment files, certificates,
  credentials, and local configuration are excluded by `.gitignore`.

`local-config.example.json` documents the optional local settings without
containing real account or organization information. Manual editing is not
required because the first-run setup screen creates the real local file.

## Local connector prerequisites

- Outlook calendar access uses the signed-in Outlook desktop application.
- Azure DevOps PR review access uses the signed-in Azure CLI session.
- The first-run form collects identifiers only. It never requests a password,
  access token, authentication cookie, client secret, or certificate.

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

## Brand reference and layout

These are the original reference screenshots for the brand and layout direction,
including the full board composition, light-blue background, and the overall
visual structure.

<p align="center">
  <img src="docs/images/brand-layout-reference.png" alt="Original brand reference showing the full goose board with light blue background and full layout" width="100%" />
</p>

## Goose brand artwork

The app changes the goose artwork to match the current activity, reminder, or
celebration.

<table>
  <tr>
    <td align="center"><img src="src/assets/goose/coding.png" alt="Coding goose" width="130" /><br /><sub>Coding</sub></td>
    <td align="center"><img src="src/assets/goose/reading.png" alt="Reading goose" width="130" /><br /><sub>Reading</sub></td>
    <td align="center"><img src="src/assets/goose/studying.png" alt="Studying goose" width="130" /><br /><sub>Studying</sub></td>
    <td align="center"><img src="src/assets/goose/meeting.png" alt="Meeting goose" width="130" /><br /><sub>Meeting</sub></td>
    <td align="center"><img src="src/assets/goose/phone.png" alt="Phone goose" width="130" /><br /><sub>Phone</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="src/assets/goose/coffee.png" alt="Coffee goose" width="130" /><br /><sub>Coffee</sub></td>
    <td align="center"><img src="src/assets/goose/lunch.png" alt="Lunch goose" width="130" /><br /><sub>Lunch</sub></td>
    <td align="center"><img src="src/assets/goose/lunch-hungry.png" alt="Hungry lunch goose" width="130" /><br /><sub>Hungry</sub></td>
    <td align="center"><img src="src/assets/goose/lunch-full.png" alt="Full lunch goose" width="130" /><br /><sub>Full</sub></td>
    <td align="center"><img src="src/assets/goose/walking.png" alt="Walking goose" width="130" /><br /><sub>Walking</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="src/assets/goose/standing.png" alt="Standing goose" width="130" /><br /><sub>Standing</sub></td>
    <td align="center"><img src="src/assets/goose/sitting.png" alt="Sitting goose" width="130" /><br /><sub>Sitting</sub></td>
    <td align="center"><img src="src/assets/goose/relaxing.png" alt="Relaxing goose" width="130" /><br /><sub>Relaxing</sub></td>
    <td align="center"><img src="src/assets/goose/thinking.png" alt="Thinking goose" width="130" /><br /><sub>Thinking</sub></td>
    <td align="center"><img src="src/assets/goose/waddling.png" alt="Waddling goose" width="130" /><br /><sub>Waddling</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="src/assets/goose/happy.png" alt="Happy goose" width="130" /><br /><sub>Happy</sub></td>
    <td align="center"><img src="src/assets/goose/thumbs-up.png" alt="Thumbs-up goose" width="130" /><br /><sub>Great work</sub></td>
    <td align="center"><img src="src/assets/goose/celebrating.png" alt="Celebrating goose" width="130" /><br /><sub>Celebrating</sub></td>
    <td align="center"><img src="src/assets/goose/ceo.png" alt="Executive goose" width="130" /><br /><sub>Executive</sub></td>
    <td align="center"><img src="src/assets/goose/angry.png" alt="Focused angry goose" width="130" /><br /><sub>Focus reminder</sub></td>
  </tr>
</table>
