# Padel Reservation Bot

Automated court reservation bot for Padel Powers (Prague, Smíchov location).

## Features

- Automatically logs into Padel Powers website
- Books the next available Wednesday slot
- Prefers 7:00 PM, falls back to 8:00 PM
- If slots unavailable, tries the following Wednesday
- **Human-like behavior** with random delays and typing simulation
- Hovers over elements before clicking
- Types character-by-character with random delays
- Random pauses between actions (500-1500ms)
- Takes screenshots for debugging
- Detailed logging of all actions

## Prerequisites

- Node.js (v16 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browser:

```bash
npm run install-browsers
```

3. Create a `.env` file in the project root with your credentials:

```bash
cat > .env << 'EOF'
EMAIL=
PASSWORD=
HEADLESS=false
LOCATION=Smíchov
DURATION=90
EOF
```

## Configuration

The `.env` file contains your credentials and settings:

```
EMAIL=
PASSWORD=
HEADLESS=false
LOCATION=Smíchov
DURATION=90
```

- `HEADLESS`: Set to `true` to run without showing the browser window
- `LOCATION`: Court location (default: Smíchov)
- `DURATION`: Booking duration in minutes (default: 90)

## Usage

Run the bot manually:

```bash
npm start
```

Or directly with Node:

```bash
node book-padel.js
```

## How It Works

1. **Date Calculation**: Finds the next Wednesday from today

   - If today is Wednesday before 7 PM, uses today
   - Otherwise uses next Wednesday

2. **Login**: Navigates to Padel Powers and logs in with credentials

3. **Booking Attempt**:

   - Tries to book 7:00 PM (19:00) slot for 90 minutes
   - If unavailable, tries 8:00 PM (20:00)
   - If both unavailable, tries next Wednesday
   - If next Wednesday also unavailable, logs failure

4. **Confirmation**: Completes the booking process

## Scheduling

To run automatically after midnight, you can use:

### macOS/Linux (cron)

```bash
crontab -e
```

Add this line to run at 12:05 AM:

```
5 0 * * * cd /Users/tomassvatek/Repositories/padel-reservation && /usr/local/bin/node book-padel.js >> /tmp/padel-bot.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to Daily at 12:05 AM
4. Set action to run: `node "C:\path\to\padel-reservation\book-padel.js"`

## Technical Details

### Website Selectors

The bot uses the following selectors based on the actual Padel Powers website structure:

**Login Page:**

- Email input: `input[type="text"].form-control` (first occurrence)
- Password input: `input[type="password"].form-control`
- Login button: `button[type="submit"].btn-primary`

**Booking Page:**

- Timeslots container: `.timeslots-container`
- Time slot buttons: `.timeslots-container button.btn-outline-primary`
- Disabled slots have class: `disabled` or attribute `disabled`

**Button Text Format:**

- Time slots display as: "19:00 1 350,00 Kč" (time + price)

## Troubleshooting

### Screenshots

The bot automatically saves screenshots to the `screenshots/` directory when:

- Before and after login
- When viewing booking pages
- On errors

### Logs

All actions are logged with timestamps. Review the console output to debug issues.

### Common Issues

1. **Login fails**: Verify credentials in `.env` file
2. **Slots not found**: The website structure may have changed; selectors may need updating
3. **Browser doesn't open**: Make sure Playwright browsers are installed: `npm run install-browsers`
4. **Page timeout**: The script uses generous timeouts (60s), but slow connections may need adjustment
5. **Slots always disabled**: This is normal if testing with dates that are fully booked

### Testing

For initial testing:

1. Set `HEADLESS=false` in `.env` to watch the bot in action
2. Run the bot during off-peak hours to see the booking flow
3. Check the `screenshots/` directory for visual debugging
4. Review console logs for step-by-step progress

## Security Notes

- Never commit the `.env` file to version control
- Keep your credentials secure
- Consider using environment variables for production use

## Customization

### Booking Preferences

To modify booking preferences, edit the `CONFIG` object in `book-padel.js`:

```javascript
const CONFIG = {
  preferredTimes: ["19:00", "20:00"], // Change booking times here
  duration: 90, // Change duration here
  // ... other settings
};
```

### Human-like Behavior

To adjust the timing of human-like delays, modify the `humanDelays` settings in `book-padel.js`:

```javascript
humanDelays: {
  min: 500,    // Minimum delay between actions (ms)
  max: 1500,   // Maximum delay between actions (ms)
  typing: 100, // Average delay between keystrokes (ms)
}
```

**What the bot does to appear human:**

- Types character-by-character with random delays (50-150ms per keystroke)
- Hovers over buttons before clicking them
- Random pauses after page loads (1-2.5 seconds)
- Random pauses before clicking (300-800ms)
- Random pauses after clicking (500-1000ms)
- Pauses to "scan" available time slots (800-1500ms)
- Pauses before final confirmation (1-2 seconds)

## License

ISC
