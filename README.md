# BLE Orientation Sensor Web App

![BLE Scanner Home Page](image/home_page_screenshot.png)

## Overview

This demo web application scans for Bluetooth Low Energy (BLE) devices that advertise a specific 128-bit Service UUID. It allows users to connect to a discovered device, inspect its characteristics, and if the device provides orientation data (Pitch, Roll, Heading), visualize this data in real-time using a 3D model powered by Three.js.

The application is designed to work with BLE peripherals that expose orientation data through specific characteristics.

## Features

*   **BLE Device Scanning:** Scans for nearby BLE devices filtering by a specific `TARGET_SERVICE_UUID`.
*   **Device Connection:** Allows connection to a selected device from the discovered list.
*   **Characteristic Inspection:** Lists characteristics for the target service on the connected device.
*   **3D Orientation Visualization:** If Pitch, Roll, and Heading characteristics are found:
    *   Displays a 3D cube that rotates according to the live orientation data.
    *   Shows interactive sliders for manual orientation control (also updated by BLE data).
*   **Live Data Display:**
    *   Presents raw and formatted BLE data in a table for monitored characteristics.
    *   Shows details from the Characteristic Presentation Format (0x2904) descriptor.
*   **Notification Control:** Allows users to start/stop notifications for individual characteristics.
*   **Status & Error Reporting:** Provides feedback on the application's state and any issues encountered.
*   **Responsive UI:** Adapts to different screen sizes.

## Prerequisites: Enabling Web Bluetooth

Web Bluetooth is an experimental feature in some browsers and might require specific flags to be enabled for the application to function.

**For Google Chrome (Recommended Browser):**

1.  Open Chrome and navigate to the address `chrome://flags`.
2.  In the search bar on the flags page, type `Experimental Web Platform features`.
3.  Find the flag named **"Experimental Web Platform features"** and set it to **Enabled**.
    *   Direct link: `chrome://flags/#enable-experimental-web-platform-features`
4.  Relaunch Chrome when prompted.

*Alternatively, for some older Chrome versions or more specific control (though the above is generally preferred now):*
1.  Navigate to `chrome://flags`.
2.  Search for `Web Bluetooth` (or `#enable-web-bluetooth`).
3.  Ensure this flag is **Enabled**.
4.  Relaunch Chrome.

**Note:** The availability and method for enabling Web Bluetooth can change with browser updates. Always ensure your browser is up-to-date. This application relies on a browser that supports the Web Bluetooth API.

## Setup & Usage

1.  **Clone the repository (or download the files):**
    If you've cloned this from GitHub:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
    Otherwise, ensure `ble_scanner_WebApp.html` and `orientation_model.js` (and the `image` folder if you have one) are in the same directory.

2.  **Ensure Prerequisites:** Make sure Web Bluetooth is enabled in your browser as described above.

3.  **Open the Application:**
    Open the `/home/bigg/Desktop/BLE Scanner web_app/ble_scanner_WebApp.html` file directly in a compatible web browser (e.g., Google Chrome).

4.  **Scanning for Devices:**
    *   Click the "Scan for Devices" button.
    *   Your browser will likely show a popup asking for permission to access Bluetooth devices. Grant permission.
    *   Another popup will appear, listing nearby BLE devices that are advertising the `TARGET_SERVICE_UUID` (defined in `orientation_model.js`). Select your target device and click "Pair" or "Connect".

5.  **Connecting & Viewing Data:**
    *   Once a device is selected, the app will attempt to connect.
    *   If successful, it will list the device's characteristics under the target service.
    *   If the required orientation characteristics (Pitch, Roll, Heading) are found, a "Show Model" button will become active.

6.  **Visualizing 3D Model:**
    *   Click the "Show Model" button.
    *   The 3D visualization area will appear, showing a cube, sliders for orientation, a table for live BLE data, and notification toggle buttons.
    *   The 3D model will update in real-time based on the data received from your BLE device.

7.  **Disconnecting:**
    *   Click the "Disconnect" button to close the BLE connection and clear the UI.

## Configuration (Important!)

This application is pre-configured to look for a specific BLE service and a set of characteristics for orientation data. If you are using a different BLE device or one with different UUIDs, you **must** update the following constant definitions at the top of the `/home/bigg/Desktop/BLE Scanner web_app/orientation_model.js` file:

```javascript
const TARGET_SERVICE_UUID = 'YOUR_SERVICE_UUID_HERE'; // e.g., '19b10010-e8f2-537e-4f6c-d104768a1214'
const TARGET_CHARACTERISTIC_PITCH_UUID = 'YOUR_PITCH_UUID_HERE';
const TARGET_CHARACTERISTIC_ROLL_UUID = 'YOUR_ROLL_UUID_HERE';
const TARGET_CHARACTERISTIC_HEADINGCOMP_UUID = 'YOUR_HEADING_UUID_HERE';
```

Ensure these UUIDs are in lowercase and match exactly those advertised and provided by your BLE peripheral.

## Technologies Used

*   HTML5
*   CSS3
*   JavaScript (ES6+)
*   Web Bluetooth API
*   Three.js (r128 for 3D rendering)

## Acknowledgements

This web application was ably developed with significant assistance from the **VS Code Gemini Code Assist Extension (Version [2.32.0])**. Its capabilities in code generation, explanation, and modification were instrumental in the creation and refinement of this project.

## License

This project can be considered under the MIT License.

---

*This README was generated to help document the BLE Scanner Web App.*