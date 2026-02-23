# Moodle → Todoist Sync Chrome Extension

[![GitHub stars](https://img.shields.io/github/stars/samjoshuadud/moodle-chrome-extension?style=social)](https://github.com/samjoshuadud/moodle-chrome-extension/stargazers)

Stop manually copying deadlines. This free extension automatically scrapes your assignments from Moodle and adds them to your favorite to-do app, Todoist. Created by a student, for students.

**For full instructions and an easier-to-read guide, visit the official website: [todomoodle.vercel.app](https://todomoodle.vercel.app)**

---

## Why Use This Extension?

* **Save Time:** No more tedious copy-pasting. Sync all your assignments in a single click.
* **Stay Organized:** See your school deadlines alongside all your other tasks in Todoist.
* **Never Miss a Deadline:** Get reminders from Todoist and keep track of everything that is due.
* **Smart & Flexible:** By default, it sets a "smart reminder date" to help you start assignments early, but you can easily switch to using the exact Moodle deadline.

## Installation

Since this extension is not on the Chrome Web Store, it needs to be installed manually in Developer Mode.

1.  **Download the Code:**
    * Click the green "Code" button on this repository's main page.
    * Select **Download ZIP**.

2.  **Unzip the File:**
    * Find the downloaded `moodle-chrome-extension-main.zip` file.
    * Unzip it. You will now have a folder named `moodle-chrome-extension-main`.

3.  **Install in Chrome:**
    * Open Google Chrome and navigate to the Extensions page by typing `chrome://extensions` in your address bar.
    * In the top-right corner, turn on the **Developer mode** toggle.
    * A new menu will appear. Click on the **Load unpacked** button.
    * In the file selection window, select the `moodle-chrome-extension-main` folder you just unzipped.
    * The "Moodle → Todoist Assignments" extension will now appear in your list of extensions and in your Chrome toolbar.

## Setup & How to Use

### 1. Add Your Todoist API Token

Your API token is like a private password that lets the extension securely connect to your Todoist account. It is stored only on your computer and never shared.

1.  **Get the Token:**
    * Open the [Todoist web app](https://todoist.com).
    * Go to **Settings** > **Integrations**.
    * Click on the **Developer** tab.
    * You will see your API token. Click the button to copy it.

2.  **Save the Token in the Extension:**
    * Click the Moodle → Todoist extension icon in your Chrome toolbar to open the settings popup.
    * Paste the token into the "Todoist Token" field.
    * (Optional) You can change the name of the Todoist project where tasks will be saved. The default is "School Assignments".
    * Click **Save**.

### 2. Choose Your Due Date Preference

In the extension popup, you have an important choice:

* **Smart Reminder Date (Default):** If you leave the checkbox unchecked, the extension will calculate a reminder date to help you start your assignments early. The actual Moodle deadline will always be in the task's description.
* **Exact Moodle Deadline:** If you check the "Use exact Moodle deadline" box, the due date in Todoist will be the final deadline from Moodle.

### 3. Sync Your Assignments

1.  Log in to your Moodle account (`tbl.*university*.edu.ph`) or your university moodle link.
2.  A blue **"⟳ Scrape"** button will appear at the bottom right of the page.
3.  Click the **Scrape** button. A sidebar will open showing all the assignments it found across your courses.
4.  The button will change to **"⟳ Sync"**. Click it again.
5.  Your assignments will be sent to your specified project in Todoist!

## Contributing & Feedback

This project was built to help fellow students. If you find a bug, have a suggestion, or want to contribute, please feel free to:

* Open an issue on this GitHub repository.
* Submit a pull request with your improvements.

If you find this tool helpful, please **give it a star on GitHub!** It helps other students discover the project and motivates future updates.

---

*Not affiliated with Moodle or Todoist.*
