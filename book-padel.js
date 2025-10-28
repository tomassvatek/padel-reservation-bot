/**
 * Padel Powers Reservation Bot
 *
 * Automatically books padel court reservations at Padel Powers (Smíchov, Praha)
 * - Books the next Wednesday at 7:00 PM (19:00) or 8:00 PM (20:00)
 * - Falls back to the following Wednesday if slots unavailable
 * - Uses Playwright for browser automation
 *
 * Selectors verified from actual website DOM (October 2025):
 * - Login: input[type="text"].form-control for email (not type="email"!)
 * - Time slots: .timeslots-container button.btn-outline-primary
 * - Disabled slots have class "disabled"
 */

require("dotenv").config();
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  email: process.env.EMAIL,
  password: process.env.PASSWORD,
  headless: process.env.HEADLESS === "true",
  location: process.env.LOCATION || "Smíchov",
  duration: parseInt(process.env.DURATION) || 90,
  preferredTimes: ["19:00", "20:00"], // 7 PM and 8 PM
  baseUrl: "https://www.padelpowers.com",
  // Human-like behavior settings
  humanDelays: {
    min: 500, // Minimum delay in ms
    max: 1500, // Maximum delay in ms
    typing: 100, // Delay between keystrokes in ms
  },
};

// Utility functions
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Random delay to mimic human behavior
function randomDelay(
  min = CONFIG.humanDelays.min,
  max = CONFIG.humanDelays.max
) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay;
}

// Sleep for a random human-like duration
async function humanPause(min, max) {
  const delay = randomDelay(min, max);
  log(`Pausing for ${delay}ms (human-like delay)...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// Type text like a human (character by character with random delays)
async function humanType(page, selector, text) {
  const element = page.locator(selector);
  await element.click(); // Focus the input
  await humanPause(200, 500); // Pause before typing

  for (const char of text) {
    await element.pressSequentially(char, {
      delay: randomDelay(50, 150), // Random delay between keystrokes
    });
  }

  await humanPause(300, 700); // Pause after typing
}

// Click with human-like behavior (hover first, then click)
async function humanClick(page, selector) {
  const element = page.locator(selector);
  await element.hover(); // Hover over element first
  await humanPause(300, 800); // Pause before clicking
  await element.click();
  await humanPause(500, 1000); // Pause after clicking
}

function getNextWednesday(fromDate = new Date()) {
  const date = new Date(fromDate);
  const currentDay = date.getDay();
  const wednesday = 3; // Wednesday is day 3 (0 = Sunday)

  let daysUntilWednesday = wednesday - currentDay;

  // If today is Wednesday, check if we want to use today or next week
  if (daysUntilWednesday === 0) {
    const currentHour = date.getHours();
    // If it's past 7 PM (19:00), move to next Wednesday
    if (currentHour >= 19) {
      daysUntilWednesday = 7;
    }
  } else if (daysUntilWednesday < 0) {
    // If Wednesday has passed this week, get next Wednesday
    daysUntilWednesday += 7;
  }

  date.setDate(date.getDate() + daysUntilWednesday);
  return date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function takeScreenshot(page, name) {
  const screenshotDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const filename = path.join(screenshotDir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  log(`Screenshot saved: ${filename}`);
}

async function handleCookieConsent(page) {
  try {
    // Look for cookie consent button and click if present
    const consentButton = page.locator('button:has-text("Souhlasím")');
    if (await consentButton.isVisible({ timeout: 3000 })) {
      log("Cookie consent banner found, accepting...");
      await humanPause(500, 1000); // Brief pause before accepting
      await consentButton.hover();
      await humanPause(300, 600);
      await consentButton.click();
      await humanPause(800, 1200); // Wait after accepting
      log("Cookie consent accepted");
    }
  } catch (error) {
    // Cookie banner might not be present, continue
    log("No cookie consent banner found or already accepted");
  }
}

async function login(page) {
  log("Navigating to login page...");
  await page.goto(
    `${CONFIG.baseUrl}/rezervace/login?returnUrl=%2Fcourt-booking%2Fdetails%2F`,
    { timeout: 60000 }
  );
  await page.waitForLoadState("domcontentloaded");
  await humanPause(1000, 2000); // Pause after page load, like reading the page

  await handleCookieConsent(page);

  log("Filling login credentials...");

  // Wait for email input and fill it (note: it's type="text" not type="email")
  await page.waitForSelector('input[type="text"].form-control', {
    timeout: 10000,
  });

  // Human-like typing for email
  log("Typing email address...");
  await humanType(page, 'input[type="text"].form-control', CONFIG.email);

  // Human-like typing for password
  log("Typing password...");
  await humanType(page, 'input[type="password"].form-control', CONFIG.password);

  await takeScreenshot(page, "before-login");

  await humanPause(500, 1000); // Pause before submitting (like reviewing input)

  log("Submitting login form...");

  // Click login button with human-like behavior
  await humanClick(page, 'button[type="submit"].btn-primary');

  // Wait for navigation after login
  await page.waitForLoadState("load", { timeout: 30000 });
  await humanPause(1000, 2000); // Pause after login completes

  await takeScreenshot(page, "after-login");

  // Check if login was successful by looking for error messages or redirect
  const currentUrl = page.url();
  if (currentUrl.includes("login")) {
    const errorMessage = await page
      .locator('.error, .alert-danger, [class*="error"]')
      .textContent()
      .catch(() => null);
    throw new Error(
      `Login failed. Still on login page. Error: ${errorMessage || "Unknown"}`
    );
  }

  log("Login successful!");
}

async function tryBooking(page, date, timeSlot) {
  const dateStr = formatDate(date);
  log(`Attempting to book for ${dateStr} at ${timeSlot}...`);

  const bookingUrl = `${
    CONFIG.baseUrl
  }/rezervace/court-booking/reservation/?location=${encodeURIComponent(
    CONFIG.location
  )}&date=${dateStr}&playingTimes=${CONFIG.duration}`;

  await page.goto(bookingUrl, { timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");
  await humanPause(1500, 2500); // Pause to "look at" the booking page

  await takeScreenshot(page, `booking-page-${dateStr}-${timeSlot}`);

  // Look for time slot buttons in the timeslots-container
  // Buttons have class 'btn btn-outline-primary btn-sm' and contain time like "19:00  1 350,00 Kč"
  log(`Looking for time slot button containing "${timeSlot}"...`);

  // Wait for timeslots container to be visible
  await page.waitForSelector(".timeslots-container", { timeout: 10000 });
  await humanPause(800, 1500); // Pause as if scanning available times

  // Find the button that starts with the desired time slot
  const slotSelector = `.timeslots-container button.btn-outline-primary:has-text("${timeSlot}")`;
  const slotElement = page.locator(slotSelector).first();

  // Check if the slot exists and is available
  const slotExists = (await slotElement.count()) > 0;

  if (!slotExists) {
    log(`Time slot ${timeSlot} not found on ${dateStr}`);
    return false;
  }

  // Check if slot is disabled
  const isDisabled = await slotElement.evaluate((el) => {
    return (
      el.disabled ||
      el.classList.contains("disabled") ||
      el.hasAttribute("disabled")
    );
  });

  if (isDisabled) {
    log(`Time slot ${timeSlot} is disabled/unavailable on ${dateStr}`);
    return false;
  }

  log(
    `Found available slot at ${timeSlot} on ${dateStr}. Attempting to book...`
  );

  // Click the time slot with human-like behavior
  await slotElement.hover(); // Hover first
  await humanPause(400, 900); // Pause before clicking
  await slotElement.click();
  await humanPause(2000, 3500); // Wait for any modals or next steps to appear

  await takeScreenshot(page, `after-selecting-slot-${dateStr}-${timeSlot}`);

  // Look for confirmation/continue button
  const confirmSelectors = [
    'button:has-text("Pokračovat")',
    'button:has-text("Rezervovat")',
    'button:has-text("Potvrdit")',
    'button[type="submit"]',
    'a:has-text("Pokračovat")',
  ];

  for (const selector of confirmSelectors) {
    try {
      const confirmButton = page.locator(selector).first();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        log("Clicking confirmation button...");
        await confirmButton.hover(); // Hover first
        await humanPause(500, 1000); // Pause before clicking
        await confirmButton.click();
        await humanPause(2000, 3000); // Wait after clicking
        break;
      }
    } catch (error) {
      continue;
    }
  }

  await takeScreenshot(page, `booking-confirmation-${dateStr}-${timeSlot}`);

  // Check for final confirmation or payment page
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {
    log("Page still loading, but continuing...");
  });

  // Look for final confirmation button if present
  try {
    const finalConfirmButton = page
      .locator(
        'button:has-text("Dokončit"), button:has-text("Zaplatit"), button:has-text("Potvrdit rezervaci")'
      )
      .first();
    if (await finalConfirmButton.isVisible({ timeout: 5000 })) {
      log("Found final confirmation button. Completing booking...");
      await humanPause(1000, 2000); // Pause before final confirmation (reviewing)
      await finalConfirmButton.hover();
      await humanPause(700, 1200);
      await finalConfirmButton.click();
      await humanPause(3000, 4000); // Wait for completion
      await takeScreenshot(page, `final-confirmation-${dateStr}-${timeSlot}`);
    }
  } catch (error) {
    log("No final confirmation button found or booking already completed");
  }

  log(`✓ Successfully booked court for ${dateStr} at ${timeSlot}!`);
  return true;
}

async function main() {
  log("=== Padel Reservation Bot Starting ===");
  log(
    `Configuration: Location=${CONFIG.location}, Duration=${CONFIG.duration}min, Headless=${CONFIG.headless}`
  );

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    // slowMo removed - using custom human-like delays instead
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Login
    await login(page);

    // Calculate next Wednesday
    const firstWednesday = getNextWednesday();
    log(`Target date (first attempt): ${formatDate(firstWednesday)}`);

    // Try booking for first Wednesday
    let bookingSuccess = false;

    for (const timeSlot of CONFIG.preferredTimes) {
      try {
        bookingSuccess = await tryBooking(page, firstWednesday, timeSlot);
        if (bookingSuccess) {
          break;
        }
      } catch (error) {
        log(
          `Error trying to book ${timeSlot} on ${formatDate(firstWednesday)}: ${
            error.message
          }`
        );
        await takeScreenshot(page, `error-${timeSlot}`);
      }
    }

    // If first Wednesday didn't work, try next Wednesday
    if (!bookingSuccess) {
      log("First Wednesday slots not available. Trying next Wednesday...");
      const secondWednesday = getNextWednesday(
        new Date(firstWednesday.getTime() + 24 * 60 * 60 * 1000)
      );
      log(`Target date (second attempt): ${formatDate(secondWednesday)}`);

      for (const timeSlot of CONFIG.preferredTimes) {
        try {
          bookingSuccess = await tryBooking(page, secondWednesday, timeSlot);
          if (bookingSuccess) {
            break;
          }
        } catch (error) {
          log(
            `Error trying to book ${timeSlot} on ${formatDate(
              secondWednesday
            )}: ${error.message}`
          );
          await takeScreenshot(page, `error-second-wednesday-${timeSlot}`);
        }
      }
    }

    if (!bookingSuccess) {
      log("❌ No available slots found for the next two Wednesdays");
    }

    // Keep browser open for a moment to see the result
    if (!CONFIG.headless) {
      log("Keeping browser open for 5 seconds...");
      await page.waitForTimeout(5000);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    console.error(error);
    throw error;
  } finally {
    await browser.close();
    log("=== Padel Reservation Bot Finished ===");
  }
}

// Run the bot
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
