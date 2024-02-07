"use strict";
var Eyes = require("@applitools/eyes-selenium").Eyes;

function main() {
    // Set desired capabilities. NOTE: selenium-webdriver should be version 3.x to be compatible with eyes.selenium
    var wd = require('selenium-webdriver'),
        desiredCaps = {
            browserName: '',
            deviceName: 'DEVICE_NAME',
            platformVersion: 'PLATFORM_VERSION',
            platformName: 'Android',
            app: 'https://applitoolsnmlresources.z19.web.core.windows.net/Tutorials/eyes-android-hello-world.apk'
        },
        // Open the app.
        driver = new wd.Builder().usingServer("http://localhost:4723/wd/hub").withCapabilities(desiredCaps).build();
    // Initialize the eyes SDK and set your private API key.
    var eyes = new Eyes();
    eyes.setApiKey("YOUR_API_KEY");
    try {
        // Start the test.
        eyes.open(driver, "Contacts", "My first Appium native JS test!");
        // Visual UI testing.
        eyes.checkWindow("Contact list!");
        // End the test.
        eyes.close();
    } finally {
        // Close the app.
        driver.quit();
        // If the test was aborted before eyes.close was called, ends the test as aborted.
        eyes.abortIfNotClosed();
    }
}

main();